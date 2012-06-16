// Import
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const Soup = imports.gi.Soup;
const St = imports.gi.St;


// Global storage
let MythTVExt = {
    // Extension metadata
    Metadata : null,

    // The button
    Button : null
};


// Spec class
function MythTV()
{
    this._init.apply(this, arguments);
}

// Implement MythTV class
MythTV.prototype =
{
    __proto__ : PanelMenu.SystemStatusButton.prototype,

    // Timer periods (seconds)
    FreeTime : 60,
    MythTime : 300,

    // Data
    Debug     : false,
    Size      : 10,
    Days      : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    WithFree  : false,
    HoursFree : "?:??",

    // Updates
    FreeEvent : null,
    MythEvent : null,

    // URLs to use
    FreeUrl : '',
    MythUrl : '',


    // ctor
    _init : function()
    {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'mythtv');

        // Read config
        let config_file = MythTVExt.Metadata.path + "/config";
        if (GLib.file_test(config_file, GLib.FileTest.EXISTS))
        {
            // There's a user config file
            // See supplied example for syntax, but basically lines of "feed-name rate-seconds url"
            this.dprint("Found user config file");
            try
            {
                let re = /^ *(.+?) +([0-9]+) +(.+)/;
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
                        else if (matches[1] != "#")
                        {
                            this.eprint("Failed to parse config file line " + line + ": '" + config_data[line] + "'");
                        }
                    }
                    else
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
                    let re = /<DBHostName>(.*?)<\/DBHostName/;
                    let matches;
                    if ((matches = re.exec(config_data)) != null)
                    {
                        this.MythUrl = "http://" + matches[1] + ":6544/xml";
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
        this.SoupSession = new Soup.SessionAsync();
        if (Soup.Session.prototype.add_feature != null)
            Soup.Session.prototype.add_feature.call(this.SoupSession, new Soup.ProxyResolverDefault());

        // Default data
        this.GbFree = "??? GB";
        if (!this.WithFree)
            this.HoursFree = "";


        // Create button
        this.StatusLabel = new St.Label({text: "Myth" + (this.WithFree ? " " + this.HoursFree : "")});

        // Replace default icon placeholder with our icon
        this.actor.get_children().forEach(function(c) { c.destroy() });
        this.actor.add_actor(this.StatusLabel);


        // Add status popup
        // .. heading 1
        let box = new St.BoxLayout({style_class:'myth-heading-row'});
        let label = new St.Label({text:"MythTV Status:"});
        box.add_actor(label);
        this.menu.addActor(box);

        // .. full free info
        box = new St.BoxLayout({style_class:'myth-data-row'});
        label = new St.Label({style_class:"myth-misc-label", text:"Free space: "});
        box.add_actor(label);
        if (this.WithFree)
        {
            // Free space with hours and GB
            this.FreeStatus = new St.Label({text:"??"});
            box.add_actor(this.FreeStatus);
            label = new St.Label({style_class:"myth-misc-label", text:" hrs ("});
            box.add_actor(label);
            this.FreeGBStatus = new St.Label({text:"?? GB"});
            box.add_actor(this.FreeGBStatus);
            label = new St.Label({style_class:"myth-misc-label myth-column", text:")"});
            box.add_actor(label);
        }
        else
        {
            // Only GB free
            this.FreeGBStatus = new St.Label({style_class:"myth-column",text:"?? GB"});
            box.add_actor(this.FreeGBStatus);
        }
        this.menu.addActor(box);

        // .. listings status
        box = new St.BoxLayout({style_class:'myth-data-row'});
        label = new St.Label({style_class:"myth-misc-label", text:"Listing days available: "});
        box.add_actor(label);
        this.ListingsStatus = new St.Label({text:"??"});
        box.add_actor(this.ListingsStatus);
        label = new St.Label({style_class:"myth-misc-label", text:".  Last fetch: "});
        box.add_actor(label);
        this.ListingsLastStatus = new St.Label({style_class:"myth-column", text:"??"});
        box.add_actor(this.ListingsLastStatus);
        this.menu.addActor(box);


        // .. heading 2
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        box = new St.BoxLayout({style_class:"myth-heading-row"});
        label = new St.Label({text:"Upcoming recordings:"});
        box.add_actor(label);
        this.menu.addActor(box);

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
        this.menu.addActor(box);

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
            this.UpcomingTitles[idx] = new St.Label({text:""});
            box.add_actor(this.UpcomingTitles[idx]);
            this.UpcomingSubtitles[idx] = new St.Label({style_class:"myth-misc-label myth-column", text:""});
            box.add_actor(this.UpcomingSubtitles[idx]);
            title_column.add_actor(box);

            // times
            this.UpcomingDays[idx]  = new St.Label({style_class:"myth-misc-label myth-padded myth-right", text:""});
            day_column.add_actor(this.UpcomingDays[idx]);
            this.UpcomingTimes[idx] = new St.Label({style_class:"myth-column", text:""});
            time_column.add_actor(this.UpcomingTimes[idx]);

            // lengths
            box = new St.BoxLayout();
            this.UpcomingLengths[idx] = new St.Label({text:""});
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
            this.FreeEvent = GLib.timeout_add_seconds(0, this.FreeTime, Lang.bind(this, function () {
                this.getMythFreeStatus();
                return true;
            }));
        this.MythEvent = GLib.timeout_add_seconds(0, this.MythTime, Lang.bind(this, function () {
            this.getMythUpcomingStatus();
            return true;
        }));
    },


    // Debug
    dprint: function(msg)
    {
        if (this.Debug)
            this.eprint(msg);
    },


    // Error
    eprint: function(msg)
    {
        global.log("MythTV: " + msg);
        if (this.Debug)
            print("MythTV: " + msg);
    },


    // Split line into a paragraph
    formatParagraph: function(text,width)
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
    },


    // Build delegate command
    xdelegateCommand: function(cmd,arg)
    {
        let exe = [
            './run-get-status',
            './' + cmd,
            arg,
            this.Tmp + arg ];
        this.dprint("command: " + exe.join(' '));
        return exe;
    },


    // Request free info.
    getMythFreeStatus: function()
    {
        this.dprint("getting free");
        if (this.FreeUrl == '')
            return;
        try
        {
            // Trigger request
            let me = this;
            let request = Soup.Message.new('GET', this.FreeUrl);
            this.SoupSession.queue_message(request, function(soup, message) {
                if (message.status_code == 200)
                    me.processMythFreeStatus(request.response_body.data);
                else
                    me.dprint("error retrieving free info: " + message.status_code);
            });
        }
        catch (err)
        {
            this.eprint("exception requesting free info.: " + err);
        }
    },


    // Request listings info.
    getMythUpcomingStatus: function()
    {
        this.dprint("getting listings");
        if (this.MythUrl == '')
            return;
        try
        {
            // Trigger request
            let me = this;
            let request = Soup.Message.new('GET', this.MythUrl);
            this.SoupSession.queue_message(request, function(soup, message) {
                if (message.status_code == 200)
                    me.processMythUpcomingStatus(request.response_body.data);
                else
                    me.dprint("error retrieving myth info: " + message.status_code);
            });
        }
        catch (err)
        {
            this.dprint("exception requesting listings info.: " + err);
        }
    },


    // Read free info.
    processMythFreeStatus: function(data)
    {
        this.dprint("processing free");

        // Free
        let hours = "??";
        let minutes = "??";
        let gb = 0;
        try
        {
            // Process results string
            let outarr = data.toString().split(/\n/);
            hours = Math.floor(outarr[1]);
            minutes = Math.floor( (outarr[1] - hours) * 60 );
            if (minutes < 10)
                minutes = "0" + minutes;
            gb = parseFloat(outarr[0]);
        }
        catch (err)
        {
            this.eprint("exception processing free info. [" + data.toString() + "]: " + err);
        }

        // Update fields
        // If hours > 99, drop the minutes
        if (hours > 99)
            this.HoursFree = "" + hours;
        else
            this.HoursFree = hours + ":" + minutes;

        if (this.WithFree)
            this.StatusLabel.set_text("Myth " + this.HoursFree);
        this.FreeStatus.set_text(this.HoursFree);
        this.FreeGBStatus.set_text(gb.toFixed(3) + " GB");
    },


    // Read listings info.
    processMythUpcomingStatus: function(data)
    {
        this.dprint("processing listings");

        // Get upcoming
        let prog = 0;
        let listings = "??";
        let listings_status = "??";
        try
        {
            let xml = data.toString();

            // Find  progs.
            let progdata = xml.split(/<Program/);
            for (;  prog < this.Size && prog < progdata.length; ++prog)
            {
                let re = /\btitle="([^"]*)".*?\bsubTitle="([^"]*)".*?\bendTime="([^"]*)".*?\bstartTime="([^"]*)"(.*)/;
                let matches;
                if ((matches = re.exec(progdata[prog+1])) != null)
                {
                    // Extract data
                    let upcoming_title    = matches[1];
                    let upcoming_subtitle = matches[2];
                    let length = (Date.parse(matches[3]) - Date.parse(matches[4])) / 1000;
                    let rest              = matches[5];
                    let length_hours = Math.floor(length/3600);
                    let length_mins  = Math.floor((length-(length_hours*3600))/60);
                    if (length_mins < 10)
                        length_mins = "0"+length_mins;
                    let start = new Date(matches[4]);
                    let end   = new Date(matches[3]);

                    // Display
                    let subtitle = ((upcoming_subtitle == "")  ?  ""  :  " (" + upcoming_subtitle + ")");
                    let start_text = start.toLocaleTimeString().replace(/:..$/,'');
                    let end_text   =   end.toLocaleTimeString().replace(/:..$/,'');
                    this.UpcomingTitles[prog].set_text(      upcoming_title );
                    this.UpcomingSubtitles[prog].set_text(   subtitle );
                    this.UpcomingDays[prog].set_text(        this.Days[start.getDay()] );
                    this.UpcomingTimes[prog].set_text(       start_text );
                    this.UpcomingLengths[prog].set_text(     length_hours + ":" + length_mins );
                    this.UpcomingLengthHours[prog].set_text( " hrs");
                    this.UpcomingTitles[prog].has_tooltip = false;

                    // OK, let's get some more
                    let more = />([^<]*)<Channel\b.*?\bchannelName="([^"]*)".*?\bchanNum="([^"]*)"/;
                    if ((matches = more.exec(rest)) != null)
                    {
                        let desc = matches[1];
                        desc = desc.replace(/&lt;/,   "<", 'g');
                        desc = desc.replace(/&gt;/,   ">", 'g');
                        desc = desc.replace(/&amp;/,  "&", 'g');
                        desc = desc.replace(/&apos;/, "'", 'g');
                        desc = desc.replace(/&quot;/, '"', 'g');
                        let tooltip_desc = this.formatParagraph(desc,64);
                        this.UpcomingTitles[prog].has_tooltip  = (tooltip_desc.length != 0);
                        this.UpcomingTitles[prog].tooltip_text =
                            matches[2] + " (#" + matches[3] + ")  " + start_text + "-" + end_text + "\n" + tooltip_desc;
                    }
                }
            }


            // Free space, if not fetching that separately
            if (!this.WithFree)
            {
                let re = /\bTotalDiskSpace\b.*?\btotal\b.*?\bfree="([^"]*)".*?\bdeleted="([^"]*)".*?\blivetv="([^"]*)"/;
                let matches;
                if ((matches = re.exec(xml)) != null)
                {
                    let gb = (parseFloat(matches[1]) + parseFloat(matches[2]) + parseFloat(matches[3]))
                            / 1024;
                    this.FreeGBStatus.set_text(gb.toFixed(3) + " GB");
                }
            }


            // Get guide status
            let guidedata = xml.split(/<Guide/);
            let re = /\bstatus="([^"]*)".*?\bguideDays="([^"]*)"/;
            let matches;
            if ((matches = re.exec(guidedata[1])) != null)
            {
                listings = matches[2];
                listings_status = matches[1].replace(/\..*/,'.');
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
            this.UpcomingTitles[prog].has_tooltip  = false;
            this.UpcomingTitles[prog].tooltip_text = "";
        }
    }
}


// Setup
function init(extensionMeta)
{
    MythTVExt.Metadata = extensionMeta;
}

// Turn on
function enable()
{
    MythTVExt.Button = new MythTV();
    Main.panel.addToStatusArea('mythtv', MythTVExt.Button);
}

// Turn off
function disable()
{
    Mainloop.source_remove(MythTVExt.Button.FreeEvent);
    Mainloop.source_remove(MythTVExt.Button.MythEvent);
    MythTVExt.Button.destroy();
    MythTVExt.Button = null;
}
