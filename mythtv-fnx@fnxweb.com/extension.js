// Import
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const St = imports.gi.St;


MythTVExt = {
    // Extension metadata
    Metadata : null,

    // The button
    Button : null
};


// Spec
function MythTV()
{
    this._init.apply(this, arguments);
}

// Impl
MythTV.prototype =
{
    __proto__ : PanelMenu.SystemStatusButton.prototype,

    // Timer periods (seconds)
    FreeTime : 45,
    MythTime : 300,

    // Data
    Debug     : false,
    Size      : 10,
    Days      : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    Delegate  : '',
    Tmp       : '',
    WithMeta  : false,
    HoursFree : "?:??",

    // Custom icon
    LogoWidth   : 40,
    LogoHeight  : 16,

    // Updates
    FreeEvent : null,
    MythEvent : null,

    // Commands to use
    FreeCommand : 'get-status-free',
    MythCommand : 'get-status-myth',


    // ctor
    _init : function()
    {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'mythtv');
        this.Delegate = MythTVExt.Metadata.path + "/delegate/";
        this.Tmp = "/tmp/_gs_mythtv_ext." + GLib.getenv("USER") + ".";

        // Default data
        // We only do fast free data checks, and GB free space reports, if there's a get-status or get-status-free
        this.GbFree = "??? GB";
        if (GLib.file_test(this.Delegate+'get-status-free', GLib.FileTest.EXISTS)  ||
            GLib.file_test(this.Delegate+'get-status', GLib.FileTest.EXISTS))
        {
            this.dprint("Found a free space reporter, running free-space checks");
            this.WithFree = true;
        }
        else
        {
            this.dprint("No free space reporter, only running listings checks");
            this.HoursFree = "";
        }

        // Now, what commands to use?
        if (GLib.file_test(this.Delegate+'get-status', GLib.FileTest.EXISTS))
        {
            this.dprint("Found a meta get-status, using that in preference to separate ones");
            this.FreeCommand = 'get-status';
            this.MythCommand = 'get-status';
        }

        // Create button
        this.StatusLabel = new St.Label({text: "Myth" + (this.WithFree ? " " + this.HoursFree : "")});

        // Replace default icon placeholder with our icon
        this.actor.get_children().forEach(function(c) { c.destroy() });
        this.actor.add_actor(this.StatusLabel);


        // Add status popup
        // .. heading 1
        box = new St.BoxLayout({style_class:'myth-heading-row'});
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

        // Update basics every 45 s., update listings every five minutes
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
            this.eprint("exception formatting paragraph");
        }
        return para;
    },


    // Build delegate command
    delegateCommand: function(cmd,arg)
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
        try
        {
            // Run request
            let [success, pid] = GLib.spawn_async(
                    this.Delegate,
                    this.delegateCommand(this.FreeCommand,'free'),
                    null,
                    GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                    null );
            if (success  &&  pid != 0)
            {
                // Wait for answer
                this.dprint("waiting for free");
                let me = this;
                GLib.child_watch_add( GLib.PRIORITY_DEFAULT, pid, function(pid,status) {
                    me.dprint("free process completed, status=" + status);
                    GLib.spawn_close_pid(pid);
                    me.readMythFreeStatus();
                });
            }
            else
            {
                this.eprint("failure requesting free info., status=" + status);
            }
        }
        catch (err)
        {
            this.eprint("exception requesting free info.");
        }
    },


    // Request listings info.
    getMythUpcomingStatus: function()
    {
        this.dprint("getting listings");
        try
        {
            // Run request
            let [success, pid] = GLib.spawn_async(
                    this.Delegate,
                    this.delegateCommand(this.MythCommand,'myth'),
                    null,
                    GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                    null );
            if (success  &&  pid != 0)
            {
                // Wait for answer
                this.dprint("waiting for listings");
                let me = this;
                GLib.child_watch_add( GLib.PRIORITY_DEFAULT, pid, function(pid,status) {
                    me.dprint("listings process completed, status=" + status);
                    GLib.spawn_close_pid(pid);
                    me.readMythUpcomingStatus();
                });
            }
            else
            {
                this.eprint("failure requesting listings info., status=" + status);
            }
        }
        catch (err)
        {
            this.dprint("exception requesting listings info.");
        }
    },


    // Read free info.
    readMythFreeStatus: function()
    {
        this.dprint("processing free");

        // Free
        let hours = "??";
        let minutes = "??";
        let gb = 0;
        try
        {
            // Check for results
            if (!GLib.file_test(this.Tmp+'free', GLib.FileTest.EXISTS))
            {
                this.eprint("free results file not found");
                return;
            }
            else
            {
                let outarr = Shell.get_file_contents_utf8_sync(this.Tmp+'free').split(/\n/);
                hours = Math.floor(outarr[1]);
                minutes = Math.floor( (outarr[1] - hours) * 60 );
                if (minutes < 10)
                    minutes = "0" + minutes;
                gb = parseFloat(outarr[0]);
            }
        }
        catch (err)
        {
            this.eprint("exception processing free info. [" + err.toString() + "]");
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
    readMythUpcomingStatus: function()
    {
        this.dprint("processing listings");

        // Get upcoming
        let prog = 0;
        let listings = "??";
        let listings_status = "??";
        try
        {
            // Check for results
            if (!GLib.file_test(this.Tmp+'myth', GLib.FileTest.EXISTS))
            {
                this.eprint("listings results file not found");
                return;
            }
            else
            {
                let xml = Shell.get_file_contents_utf8_sync(this.Tmp+'myth').toString();

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
                    let re = /\bTotalDiskSpace\b.*?\btotal\b.*?\bfree="([^"]*)"/;
                    let matches;
                    if ((matches = re.exec(xml)) != null)
                    {
                        let gb = parseFloat(matches[1]) / 1024;
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
        }
        catch (err)
        {
            this.eprint("exception processing listings info.");
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
