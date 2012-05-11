#!/usr/bin/gjs

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

var size = 10;

var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getMythStatus()
{
    // Get free
    let hours = "??";
    let minutes = "??";
    try
    {
        let [res, out, err, status] = GLib.spawn_command_line_sync('get-status free');
        if (res && status == 0)
        {
            let outarr = out.toString().split(/\n/);
            hours = Math.floor(outarr[1]);
            minutes = Math.floor( (outarr[1] - hours) * 60 );
            if (minutes < 10)
                minutes = "0"+minutes;
        }
    }
    catch (err)  {}

    print("Myth " + hours + ":" + minutes);


    // Get upcoming
    var xml;
    let upcoming_title = [];
    let upcoming_subtitle = [];
    let upcoming_time = [];
    let upcoming_endtime = [];
    let upcoming_length = [];
    let guide_status = '';
    for (let idx = 0;  idx < size;  ++idx)
        upcoming_title[idx] = "";
    try
    {
        let [res, out, err, status] = GLib.spawn_command_line_sync('get-status myth');
        if (res && status == 0)
        {
            xml = out.toString();

            // Find  progs.
            let progdata = xml.split(/<Program/);
            let prog = 0;
            for (;  prog < size && prog < progdata.length; ++prog)
            {
                var re = / title="([^"]*)" subTitle="([^"]*)" .* endTime="([^"]*)" startTime="([^"]*)"/;
                var matches;
                if ((matches = re.exec(progdata[prog+1])) != null)
                {
                    upcoming_title[prog]    = matches[1];
                    upcoming_subtitle[prog] = matches[2];
                    let length = (Date.parse(matches[3]) - Date.parse(matches[4])) / 1000;
                    let length_hours = Math.floor(length/3600);
                    let length_mins  = Math.floor((length-(length_hours*3600))/60);
                    if (length_mins < 10)
                        length_mins = "0"+length_mins;
                    upcoming_length[prog]   = length_hours + ":" + length_mins;
                    let start = new Date(matches[3]);
                    let start_time = days[start.getDay()] + " " + start.toLocaleTimeString();
                    upcoming_time[prog] = start_time.replace(/:..$/,'');
                }
            }
            for (;  prog < size; ++prog)
                upcoming_title[prog]    = '';

            // Get guide status
            let guidedata = xml.split(/<Guide/);
            var re = / status="([^"]*)" .* guideDays="([^"]*)"/;
            var matches;
            if ((matches = re.exec(guidedata[1])) != null)
            {
                guide_status = "Listings days available: " + matches[2] + ".  Last fetch: " + matches[1];
            }
        }
    }
    catch (err)  {}

    print("Upcoming:");
    for (let idx = 0;  idx < size;  ++idx)
        print(
                upcoming_title[idx] + ", " +
                upcoming_subtitle[idx] + ", " +
                upcoming_time[idx] + ", " +
                upcoming_length[idx] );

    print(guide_status);
}

getMythStatus();

