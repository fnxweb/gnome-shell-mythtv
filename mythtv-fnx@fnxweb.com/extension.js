// Import
const { Atk, Clutter, GLib, GObject, Shell, Soup, St } = imports.gi;
const { main, panelMenu, popupMenu } = imports.ui;

const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils

const IndicatorName = 'MythTV';


// The button
let MythTVExtButton = null;


// Implement MythTV class
const MythTV = GObject.registerClass(
class MythTV extends panelMenu.Button
{
    // ctor
    _init()
    {
        super._init( null, IndicatorName );

        // Us
        this.Metadata = ExtensionUtils.getCurrentExtension();
        this.Name     = IndicatorName;

        // Processing
        this.Decoder = new TextDecoder('utf8');

        // Timer periods (seconds)
        this.FreeTime = 60;
        this.MythTime = 300;

        // Data
        this.Debug     = false;
        this.Size      = 10;
        this.Days      = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        this.WithFree  = false;
        this.HoursFree = "?:??";
        this.Used      = "??%";

        // Updates
        this.FreeEvent = null;
        this.MythEvent = null;

        // URLs to use
        this.FreeUrl = '';
        this.MythUrl = '';

        // Read config
        let config_file = this.Metadata.path + "/config";
        if (GLib.file_test(config_file, GLib.FileTest.EXISTS))
        {
            // There's a user config file
            // See supplied example for syntax, but basically lines of "feed-name rate-seconds url"
            this.dprint("Found user config file");
            try
            {
                let re = /^ *([^#]+?) +([0-9]+) +(.+)/;
                let r0 = /^ *(#.*)?$/;
                let matches;
                let config_data = Shell.get_file_contents_utf8_sync(config_file).split(/\n/);
                for (let line = 0;  line < config_data.length;  ++line)
                {
                    // Extract type and URL from line
                    if (config_data[line].length  &&  (matches = re.exec(config_data[line])) != null)
                    {
                        if (matches[1] == "free")
                        {
                            // Free space config
                            this.WithFree = true;
                            this.FreeTime = 0 + matches[2];
                            this.FreeUrl  = matches[3];
                            this.dprint("Reading free at " + this.FreeTime + " seconds from " + this.FreeUrl);
                        }
                        else if (matches[1] == "myth")
                        {
                            // Myth XML config
                            this.MythTime = 0 + matches[2];
                            this.MythUrl = matches[3];
                            this.dprint("Reading Myth at " + this.MythTime + " seconds from " + this.MythUrl);
                        }
                        else
                        {
                            this.eprint("Failed to parse config file line " + line + ": '" + config_data[line] + "'");
                        }
                    }
                    else if (config_data[line].length  &&  (matches = r0.exec(config_data[line])) == null)
                    {
                        this.eprint("Unrecognised config file line " + line + ": '" + config_data[line] + "'");
                    }
                }
            }
            catch (err)
            {
                this.eprint("Exception reading user config file: " + err);
            }
        }
        else
        {
            // Use default config (no free, only basic myth direct from server)
            this.dprint("No user config file");
            try
            {
                let myth_config = GLib.getenv("HOME") + "/.mythtv/config.xml";
                if (GLib.file_test(myth_config, GLib.FileTest.EXISTS))
                {
                    // We only want the MythTV server name
                    let config_data = Shell.get_file_contents_utf8_sync(myth_config);
                    let re = /<Host>(.*?)<\/Host/;
                    let matches;
                    if ((matches = re.exec(config_data)) == null)
                        re = /<DBHostName>(.*?)<\/DBHostName/;
                    if ((matches = re.exec(config_data)) != null)
                    {
                        this.MythUrl = "http://" + matches[1] + ":6544/Status/xml";
                        this.dprint("Reading Myth at " + this.MythTime + " seconds from " + this.MythUrl);
                    }
                    else
                    {
                        this.eprint("Failed to parse ~/.mythtv/config.xml");
                    }
                }
                else
                {
                    this.eprint("Failed to find ~/.mythtv/config.xml");
                }
            }
            catch (err)
            {
                this.eprint("Exception reading user config file: " + err);
            }
        }


        // Create a Soup session with which to do requests
        this.SoupSession = new Soup.Session();

        // Default data
        this.GbFree = "??? GB";
        if (!this.WithFree)
        {
            this.HoursFree = "";
            this.Used = "";
        }


        // Create button
        this.StatusLabel = new St.Label({
            text: "Myth" + (this.WithFree ? " " + this.HoursFree : ""),
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        // Replace default icon placeholder with our icon
        this.add_child( this.StatusLabel );


        // Prep. menu
        if (main.panel._menus == undefined)
            main.panel.menuManager.addMenu(this.menu);
        else
            main.panel._menus.addMenu(this.menu);


        // Add status popup
        // .. heading 1
        let box = new St.BoxLayout({style_class:'myth-heading-row'});
        let label = new St.Label({style_class:'stage popup-menu myth-data', text:"MythTV Status:"});
        box.add_actor(label);
        this.addMenuItem(box);
        let status_column = new St.BoxLayout({vertical:true});

        // .. full free info
        box = new St.BoxLayout({style_class:'myth-data-row'});
        label = new St.Label({style_class:"myth-misc-label", text:"Free space:  "});
        box.add_actor(label);
        if (this.WithFree)
        {
            // Free space with hours and GB
            this.FreeStatus = new St.Label({style_class:'stage popup-menu myth-data', text:"??"});
            box.add_actor(this.FreeStatus);
            label = new St.Label({style_class:"myth-misc-label", text:" hrs  ("});
            box.add_actor(label);
            this.FreeGBStatus = new St.Label({style_class:'stage popup-menu myth-data', text:"?? GB"});
            box.add_actor(this.FreeGBStatus);
            label = new St.Label({style_class:"myth-misc-label", text:")"});
            box.add_actor(label);
        }
        else
        {
            // Only GB free
            this.FreeGBStatus = new St.Label({style_class:"stage popup-menu myth-data",text:"?? GB"});
            box.add_actor(this.FreeGBStatus);
        }
        status_column.add_actor(box);

        // .. listings status
        box = new St.BoxLayout({style_class:'myth-data-row'});
        label = new St.Label({style_class:"myth-misc-label", text:"Listing days available:  "});
        box.add_actor(label);
        this.ListingsStatus = new St.Label({style_class:'stage popup-menu myth-data', text:"??"});
        box.add_actor(this.ListingsStatus);
        label = new St.Label({style_class:"myth-misc-label", text:".  Last fetch:  "});
        box.add_actor(label);
        this.ListingsLastStatus = new St.Label({style_class:"stage popup-menu myth-data", text:"??"});
        box.add_actor(this.ListingsLastStatus);
        status_column.add_actor(box);

        // Done status section
        this.addMenuItem(status_column);


        // .. heading 2
        this.menu.addMenuItem(new popupMenu.PopupSeparatorMenuItem());
        box = new St.BoxLayout({style_class:"myth-heading-row"});
        label = new St.Label({style_class:'stage popup-menu myth-data', text:"Upcoming recordings:"});
        box.add_actor(label);
        this.addMenuItem(box);

        // .. upcoming
        // .. .. build box layout
        box = new St.BoxLayout({style_class:"myth-data-row"});
        let title_column  = new St.BoxLayout({vertical:true});
        let day_column    = new St.BoxLayout({vertical:true});
        let time_column   = new St.BoxLayout({vertical:true});
        let length_column = new St.BoxLayout({vertical:true});
        box.add_actor(title_column);
        box.add_actor(day_column);
        box.add_actor(time_column);
        box.add_actor(length_column);
        this.addMenuItem(box);

        // .. .. create data stores
        this.UpcomingTitles    = [];
        this.UpcomingSubtitles = [];
        this.UpcomingDays      = [];
        this.UpcomingTimes     = [];
        this.UpcomingLengths   = [];
        this.UpcomingLengthHours = [];
        for (let idx = 0;  idx < this.Size;  ++idx)
        {
            // titles
            box = new St.BoxLayout();
            this.UpcomingTitles[idx] = new St.Label({style_class:'stage popup-menu myth-data', text:""});
            box.add_actor(this.UpcomingTitles[idx]);
            this.UpcomingSubtitles[idx] = new St.Label({style_class:"myth-misc-label myth-column", text:""});
            box.add_actor(this.UpcomingSubtitles[idx]);
            title_column.add_actor(box);

            // times
            this.UpcomingDays[idx]  = new St.Label({style_class:"myth-misc-label myth-padded myth-right", text:""});
            day_column.add_actor(this.UpcomingDays[idx]);
            this.UpcomingTimes[idx] = new St.Label({style_class:"stage popup-menu myth-data myth-column", text:""});
            time_column.add_actor(this.UpcomingTimes[idx]);

            // lengths
            box = new St.BoxLayout();
            this.UpcomingLengths[idx] = new St.Label({style_class:'stage popup-menu myth-length myth-right', text:""});
            box.add_actor(this.UpcomingLengths[idx]);
            this.UpcomingLengthHours[idx] = new St.Label({style_class:"myth-misc-label myth-column", text:""});
            box.add_actor(this.UpcomingLengthHours[idx]);
            length_column.add_actor(box);
        }
        

        // Initial status
        if (this.WithFree)
            this.getMythFreeStatus();
        this.getMythUpcomingStatus();

        // Update basics frequently, update listings every five minutes
        if (this.WithFree)
            this.FreeEvent = GLib.timeout_add_seconds(0, this.FreeTime, () => {
                this.getMythFreeStatus();
                return true;
            });
        this.MythEvent = GLib.timeout_add_seconds(0, this.MythTime, () => {
            this.getMythUpcomingStatus();
            return true;
        });
    }


    // Debug
    dprint(msg)
    {
        if (this.Debug)
            this.eprint(msg);
    }

    // Error
    eprint(msg)
    {
        global.log("MythTV: " + msg);
        if (this.Debug)
            print("MythTV: " + msg);
    }


    // Add an item to the “menu”
    addMenuItem(item)
    {
        let menuitem = new popupMenu.PopupBaseMenuItem({ reactive:false });
        menuitem.actor.add_actor( item );
        this.menu.addMenuItem( menuitem );
    }


    // Split line into a paragraph
    formatParagraph(text,width)
    {
        let para = "";
        try
        {
            let words = new RegExp("(.{0," + width + "}[^ ]*) (.*)");
            while (text.length > width)
            {
                let matches = words.exec(text);
                if (matches != null)
                {
                    // We have a line, and some more afterwards.
                    let newline = matches[1];
                    let therest = matches[2];

                    // Check that the next word isn't too long.
                    let last = newline.replace(/^.* ([^ ]+)$/, "$1");
                    if (newline.length > width  &&  (newline.length - width) > (width - (newline.length - last.length - 1)))
                    {
                        // last word makes line too long, so move it on to next line.
                        newline = newline.substring(0,newline.length - last.length - 1);
                        therest = last + " " + therest;
                    }

                    // And add
                    para = para + newline + "\n";
                    text = therest;
                }
                else
                {
                    break;
                }
            }

            // Mop up
            if (text.length)
                para = para + text; 
        }
        catch (err)
        {
            this.eprint("exception formatting paragraph: " + err);
        }
        return para;
    }


    // Un-escape XML encoded strings
    unescapeString(xmlstr)
    {
        xmlstr = xmlstr.replace(/&lt;/,   '<', 'g');
        xmlstr = xmlstr.replace(/&gt;/,   '>', 'g');
        xmlstr = xmlstr.replace(/&quot;/, '"', 'g');
        xmlstr = xmlstr.replace(/&apos;/, "'", 'g');
        xmlstr = xmlstr.replace(/&amp;/,  '&', 'g');
        return xmlstr;
    }


    // Request free info.
    getMythFreeStatus()
    {
        this.dprint("getting free");
        if (this.FreeUrl == '')
            return;
        try
        {
            // Trigger request
            let me = this;
            let request = Soup.Message.new('GET', this.FreeUrl);
            this.SoupSession.send_and_read_async(
                request,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    if (request.get_status() === Soup.Status.OK)
                    {
                        let bytes = session.send_and_read_finish(result);
                        let response = this.Decoder.decode(bytes.get_data());
                        me.processMythFreeStatus(response);
                    }
                    else
                        me.dprint("error retrieving free info: " + request.get_status());
                });
        }
        catch (err)
        {
            this.eprint("exception requesting free info.: " + err);
        }
    }


    // Request listings info.
    getMythUpcomingStatus()
    {
        this.dprint("getting listings");
        if (this.MythUrl == '')
            return;
        try
        {
            // Trigger request
            let me = this;
            let request = Soup.Message.new('GET', this.MythUrl);
            this.SoupSession.send_and_read_async(
                request,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    if (request.get_status() === Soup.Status.OK)
                    {
                        let bytes = session.send_and_read_finish(result);
                        let response = this.Decoder.decode(bytes.get_data());
                        me.processMythUpcomingStatus(response);
                    }
                    else
                        me.dprint("error retrieving myth info: " + request.get_status());
                });
        }
        catch (err)
        {
            this.dprint("exception requesting listings info.: " + err);
        }
    }


    // Read free info.
    processMythFreeStatus(data)
    {
        this.dprint("processing free");

        // Free
        let hours = "??";
        let minutes = "??";
        let gb = 0;
        this.Used = 0;
        try
        {
            // Process results string
            let outarr = data.toString().split(/\n/);
            if (outarr.length >= 2)
                hours = Math.floor(outarr[1]);
            if (outarr.length >= 2)
                minutes = Math.floor( (outarr[1] - hours) * 60 );
            if (minutes < 10)
                minutes = "0" + minutes;
            gb = parseFloat(outarr[0]);
            if (outarr.length >= 3)
                this.Used = "" + Math.floor(outarr[2]) + "%";
        }
        catch (err)
        {
            this.eprint("exception processing free info. [" + data.toString() + "]: " + err);
        }

        // If hours >= 100, drop the minutes
        if (hours >= 100)
            this.HoursFree = "" + hours;
        else
            this.HoursFree = hours + ":" + minutes;

        // Update fields
        if (this.WithFree)
        {
            // If hours > 150, use % used
            if (hours >= 150)
                this.StatusLabel.set_text("Myth " + this.Used);
            else
                this.StatusLabel.set_text("Myth " + this.HoursFree);
        }
        this.FreeStatus.set_text(this.HoursFree);
        this.FreeGBStatus.set_text(gb.toFixed(1) + " GB");
    }


    // Read listings info.
    processMythUpcomingStatus(data)
    {
        this.dprint("processing listings");

        // Get upcoming
        let prog = 0;
        let listings = "??";
        let listings_status = "??";
        let utc_mode = false;
        let mythver = 0.0;
        try
        {
            let xml = data.toString();

            // Get Myth version (0.26+ uses UTC times, previous used localtime)
            let stat = xml.split(/<Status/);
            if (stat.length > 1)
            {
                let vnre = /\bversion="([0-9]+\.[0-9]+)/;
                let matches = vnre.exec(stat[1]);
                if (matches != null)
                    mythver = parseFloat(matches[1]);
                if (mythver == 0.26)  // before 0.26 was localtime, from 0.27 gives TZ in string:  force 0.26 to parse UTC
                    utc_mode = true;
            }
            this.dprint("found version " + mythver);

            // Find  progs.
            let progdata = xml.split(/<Program/);
            for (;  prog < this.Size && prog < progdata.length-1; ++prog)
            {
                // Pull out required program fields
                let matches = { 'title':0, 'subTitle':0, 'endTime':0, 'startTime':0 };
                for (let key in matches)
                {
                    let re = new RegExp('\\b' + key + '="([^"]*)"');
                    let found = re.exec(progdata[prog+1]);
                    if (found != null)
                        matches[key] = found[1];
                }

                // Extract data
                let upcoming_title    = this.unescapeString(matches['title']);
                let upcoming_subtitle = this.unescapeString(matches['subTitle']);
                let length = (Date.parse(matches['endTime']) - Date.parse(matches['startTime'])) / 1000;
                let length_hours = Math.floor(length/3600);
                let length_mins  = Math.floor((length-(length_hours*3600))/60);
                if (length_mins < 10)
                    length_mins = "0"+length_mins;
                let start = new Date(matches['startTime']);
                let end   = new Date(matches['endTime']);
                if (utc_mode)
                {
                    start.setUTCHours( start.getHours() );
                    end.setUTCHours(   end.getHours()   );
                }

                // Display
                let subtitle = ((upcoming_subtitle == "")  ?  ""  :  "  (" + upcoming_subtitle + ")");
                let start_text = start.toLocaleTimeString().replace(/:..$/,'');
                let end_text   =   end.toLocaleTimeString().replace(/:..$/,'');
                this.UpcomingTitles[prog].set_text(      upcoming_title );
                this.UpcomingSubtitles[prog].set_text(   subtitle );
                this.UpcomingDays[prog].set_text(        this.Days[start.getDay()] );
                this.UpcomingTimes[prog].set_text(       start_text );
                this.UpcomingLengths[prog].set_text(     length_hours + ":" + length_mins );
                this.UpcomingLengthHours[prog].set_text( " hrs");
            }


            // Free space, if not fetching that separately
            if (!this.WithFree)
            {
                // Find TotalDiskSpace group
                this.dprint("Reading free space locally");
                let re = new RegExp('<Group\\b[^>]*"TotalDiskSpace"[^>]*/>');
                let totaldiskspace_matches = re.exec(xml);
                if (totaldiskspace_matches == null)
                {
                    this.dprint("NOT FOUND TotalDiskSpace");
                }
                else
                {
                    let totaldiskspace = totaldiskspace_matches[0];

                    // Pull out required space fields
                    let matches = { 'free':0, 'deleted':0, 'livetv':0 };
                    for (let key in matches)
                    {
                        re = new RegExp('\\b' + key + '="([^"]*)"');
                        let found = re.exec(totaldiskspace);
                        if (found != null)
                            matches[key] = found[1];
                    }

                    // Calculate
                    let gb = (parseFloat(matches['free']) + parseFloat(matches['deleted']) + parseFloat(matches['livetv']))
                            / 1024;
                    this.FreeGBStatus.set_text(gb.toFixed(3) + " GB");
                }
            }


            // Find Guide group
            this.dprint("Reading guide data");
            let re = new RegExp('<Guide\\b.*</Guide>');
            let guide_matches = re.exec(xml);
            if (guide_matches == null)
            {
                re = new RegExp('<Guide\\b[^>]*/>');
                guide_matches = re.exec(xml);
            }
            if (guide_matches == null)
            {
                this.dprint("NOT FOUND Guide");
            }
            else
            {
                let guide = guide_matches[0];

                // Pull out required guide fields
                let matches = { 'status':'<?>', 'guideDays':'<?>' };
                for (let key in matches)
                {
                    re = new RegExp('\\b' + key + '="([^"]*)"');
                    let found = re.exec(guide);
                    if (found != null)
                        matches[key] = found[1];
                }

                // Get guide status
                listings = matches['guideDays'];
                listings_status = matches['status'].replace(/\..*/,'.');
            }
        }
        catch (err)
        {
            this.eprint("exception processing listings info.: " + err);
        }

        // Set guide data
        this.ListingsStatus.set_text(listings);
        this.ListingsLastStatus.set_text(listings_status);

        // Blank the rest of upcoming
        for (;  prog < this.Size; ++prog)
        {
            this.UpcomingTitles[prog].set_text(      '' );
            this.UpcomingSubtitles[prog].set_text(   '' );
            this.UpcomingDays[prog].set_text(        '' );
            this.UpcomingTimes[prog].set_text(       '' );
            this.UpcomingLengths[prog].set_text(     '' );
            this.UpcomingLengthHours[prog].set_text( '' );
        }
    }
});


// Setup
function init()
{
}

// Turn on
function enable()
{
    MythTVExtButton = new MythTV();
    main.panel.addToStatusArea( IndicatorName, MythTVExtButton );
}

// Turn off
function disable()
{
    Mainloop.source_remove(MythTVExtButton.FreeEvent);
    Mainloop.source_remove(MythTVExtButton.MythEvent);
    MythTVExtButton.destroy();
    MythTVExtButton = null;
}
