// Import
const St = imports.gi.St;
const Panel = imports.ui.panel;
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;


// Extension metadata
let MythTVMetadata = null;

// The button
let MythTVButton = null;

// Update timers
let MythTVEvent = null;
let MythTVUpcomingEvent = null;


// Spec
function MythTV()
{
    this._init.apply(this, arguments);
}

// Impl
MythTV.prototype =
{
    __proto__ : PanelMenu.SystemStatusButton.prototype,

    Size : 10,
    Days : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],

    _init : function()
    {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'mythtv');

        // Default data
        this.GbFree = "??? GB";
        this.HoursFree = "?:??";

        // Create button
        this.StatusLabel = new St.Label({text: "Myth " + this.HoursFree});

        // Replace default icon placeholder with our StatusLabel
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
        this.FreeStatus = new St.Label({text:"??"});
        box.add_actor(this.FreeStatus);
        label = new St.Label({style_class:"myth-misc-label", text:" hrs ("});
        box.add_actor(label);
        this.FreeGBStatus = new St.Label({text:"?? GB"});
        box.add_actor(this.FreeGBStatus);
        label = new St.Label({style_class:"myth-misc-label", text:")"});
        box.add_actor(label);
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
            label = new St.Label({style_class:"myth-misc-label myth-column", text:" hrs"});
            box.add_actor(label);
            length_column.add_actor(box);
        }
        

        // Initial status
        this.getMythStatus();
        this.getMythUpcomingStatus();

        // Update basics every 45 s., update listings every five minutes
        MythTVEvent = GLib.timeout_add_seconds(0, 45, Lang.bind(this, function () {
            this.getMythStatus();
            return true;
        }));
        MythTVUpcomingEvent = GLib.timeout_add_seconds(0, 300, Lang.bind(this, function () {
            this.getMythUpcomingStatus();
            return true;
        }));
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
        catch (err) {}
        return para;
    },


    getMythStatus: function()
    {
        // Free
        var hours = "??";
        var minutes = "??";
        var gb = 0;
        try
        {
            let [res, out, err, status] = GLib.spawn_command_line_sync('get-status free');
            if (res && status == 0)
            {
                let outarr = out.toString().split(/\n/);
                hours = Math.floor(outarr[1]);
                minutes = Math.floor( (outarr[1] - hours) * 60 );
                if (minutes < 10)
                    minutes = "0" + minutes;
                gb = parseFloat(outarr[0]);
            }
        }
        catch (err)  {}

        // Update fields
        let hoursfree = hours + ":" + minutes;

        this.StatusLabel.set_text("Myth " + hoursfree);
        this.FreeStatus.set_text(hoursfree);
        this.FreeGBStatus.set_text(gb.toFixed(3) + " GB");
    },


    getMythUpcomingStatus: function()
    {
        // Get upcoming
        let prog = 0;
        let listings = "??";
        let listings_status = "??";
        try
        {
            let [res, out, err, status] = GLib.spawn_command_line_sync('get-status myth');
            if (res && status == 0)
            {
                let xml = out.toString();

                // Find  progs.
                let progdata = xml.split(/<Program/);
                for (;  prog < this.Size && prog < progdata.length; ++prog)
                {
                    var re = /\btitle="([^"]*)".*\bsubTitle="([^"]*)" .*.*\bendTime="([^"]*)".*\bstartTime="([^"]*)"(.*)/;
                    var matches;
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
                        this.UpcomingTitles[prog].set_text(    upcoming_title );
                        this.UpcomingSubtitles[prog].set_text( subtitle );
                        this.UpcomingDays[prog].set_text(      this.Days[start.getDay()] );
                        this.UpcomingTimes[prog].set_text(     start_text );
                        this.UpcomingLengths[prog].set_text(   length_hours + ":" + length_mins );
                        this.UpcomingTitles[prog].has_tooltip  = false;

                        // OK, let's get some more
                        var more = />([^<]*)<Channel\b.*\bchannelName="([^"]*)".*\bchanNum="([^"]*)"/;
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


                // Get guide status
                let guidedata = xml.split(/<Guide/);
                var re = /\bstatus="([^"]*)".*\bguideDays="([^"]*)"/;
                var matches;
                if ((matches = re.exec(guidedata[1])) != null)
                {
                    listings = matches[2];
                    listings_status = matches[1].replace(/\..*/,'.');
                }
            }
        }
        catch (err)  {}

        // Set guide data
        this.ListingsStatus.set_text(listings);
        this.ListingsLastStatus.set_text(listings_status);

        // Blank the rest of upcoming
        for (;  prog < this.Size; ++prog)
        {
            this.UpcomingTitles[prog].set_text(    '' );
            this.UpcomingSubtitles[prog].set_text( '' );
            this.UpcomingDays[prog].set_text(      '' );
            this.UpcomingTimes[prog].set_text(     '' );
            this.UpcomingLengths[prog].set_text(   '' );
            this.UpcomingTitles[prog].has_tooltip  = false;
            this.UpcomingTitles[prog].tooltip_text = "";
        }
    }
}


// Debug
function dprint(msg)
{
    global.log(msg);
}


// Setup
function init(extensionMeta)
{
    MythTVMetadata = extensionMeta;
}

// Turn on
function enable()
{
    MythTVButton = new MythTV();
    Main.panel.addToStatusArea('mythtv', MythTVButton);
}

// Turn off
function disable()
{
    MythTVButton.destroy();
    Mainloop.source_remove(MythTVEvent);
    Mainloop.source_remove(MythTVUpcomingEvent);
    MythTVButton = null;
}