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

// Update timer
let MythTVEvent = null;


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
        // .. icon
        // let icon = Gio.icon_new_for_string( MythTVMetadata.path + "/mythtv-mono.png" );
        // let logo = new St.Icon({
        //     gicon: icon,
        //     icon_size: Panel.PANEL_ICON_SIZE
        // });
        // .. text
        this.StatusLabel = new St.Label({
            text: "Myth " + this.HoursFree,
            style_class: "mythtv-label"
        });
        // .. combine
        let box = new St.BoxLayout();
        // box.add_actor(logo);
        box.add_actor(this.StatusLabel);

        // Replace default icon placeholder with our StatusLabel
        this.actor.get_children().forEach(function(c) { c.destroy() });
        this.actor.add_actor(box);


        // Add status popup
        // .. full free info
        this.FreeStatusItem = new PopupMenu.PopupMenuItem( '', { reactive: false });
        this.FreeStatus = new St.Label({text: "Storage:  free ??)" });
        this.FreeStatusItem.addActor(this.FreeStatus);
        this.menu.addMenuItem(this.FreeStatusItem);

        // .. listings status
        this.ListingsStatusItem = new PopupMenu.PopupMenuItem( '', { reactive: false });
        this.ListingsStatus = new St.Label({text: "Listings:  ??"});
        this.ListingsStatusItem.addActor(this.ListingsStatus);
        this.menu.addMenuItem(this.ListingsStatusItem);

        // .. upcoming
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.UpcomingStatusItems = [];
        this.UpcomingStatuses = [];
        for (let idx = 0;  idx < this.Size;  ++idx)
        {
            this.UpcomingStatusItems[idx] = new PopupMenu.PopupMenuItem( '', { reactive: false });
            this.UpcomingStatuses[idx] = new St.Label({text: "??"});
            this.UpcomingStatusItems[idx].addActor(this.UpcomingStatuses[idx]);
            this.menu.addMenuItem(this.UpcomingStatusItems[idx]);
        }
        

        // Initial status
        this.getMythStatus();

        // Update every minute
        MythTVEvent = GLib.timeout_add_seconds(0, 60, Lang.bind(this, function () {
            this.getMythStatus();
            return true;
        }));
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
                gb = parseFloat(outarr[0]);
            }
        }
        catch (err)  {}

        // Update fields
        let hoursfree = hours + ":" + minutes;

        this.StatusLabel.set_text("Myth " + hoursfree);
        this.FreeStatus.set_text("Free " + hoursfree + " (" + gb.toFixed(3) + " GB)" );


        // Get upcoming
        // try
        // {
            let [res, out, err, status] = GLib.spawn_command_line_sync('get-status myth');
            if (res && status == 0)
            {
                let xml = out.toString();

                // Find  progs.
                let progdata = xml.split(/<Program/);
                let prog = 0;
                for (;  prog < this.Size && prog < progdata.length; ++prog)
                {
                    var re = / title="([^"]*)" subTitle="([^"]*)" .* endTime="([^"]*)" startTime="([^"]*)"/;
                    var matches;
                    if ((matches = re.exec(progdata[prog+1])) != null)
                    {
                        // Extract data
                        let upcoming_title    = matches[1];
                        let upcoming_subtitle = matches[2];
                        let length = (Date.parse(matches[3]) - Date.parse(matches[4])) / 1000;
                        let length_hours = Math.floor(length/3600);
                        let length_mins  = Math.floor((length-(length_hours*3600))/60);
                        if (length_mins < 10)
                            length_mins = "0"+length_mins;
                        upcoming_length   = length_hours + ":" + length_mins;
                        let start = new Date(matches[3]);
                        let start_time = this.Days[start.getDay()] + " " + start.toLocaleTimeString();
                        let upcoming_time = start_time.replace(/:..$/,'');

                        // Display
                        let subtitle = ((upcoming_subtitle == "")  ?  ""  :  " (" + upcoming_subtitle + ")");
                        this.UpcomingStatuses[prog].set_text(
                            upcoming_title + subtitle + "  starts " +
                            upcoming_time + " (" +
                            upcoming_length + ")" );
                    }
                }
                // Blank the rest
                for (;  prog < this.Size; ++prog)
                    this.UpcomingStatuses[prog].set_text('');


                // Get guide status
                let guidedata = xml.split(/<Guide/);
                var re = / status="([^"]*)" .* guideDays="([^"]*)"/;
                var matches;
                if ((matches = re.exec(guidedata[1])) != null)
                    this.ListingsStatus.set_text("Listings days available: " + matches[2] + ".  Last fetch: " + matches[1]);
                else
                    this.ListingsStatus.set_text("");
            }
        // }
        // catch (err)  {}
    }
}


// Debug
function dprint(msg)
{
    global.log(msg);
    Util.spawn(['echo',msg]);
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
    MythTVButton = null;
}
