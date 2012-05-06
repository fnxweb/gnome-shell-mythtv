#!/usr/bin/gjs

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

var size = 10;

function getMythStatus()
{
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
        }
    }
    catch (err)  {}

    print("Myth " + hours + ":" + minutes);


    var xml;
    let upcoming = [];
    for (let idx = 0;  idx < size;  ++idx)
        upcoming[idx] = "";
    try
    {
        let [res, out, err, status] = GLib.spawn_command_line_sync('get-status myth');
        if (res && status == 0)
        {
            xml = out.toString();
        }
    }
    catch (err)  {}

    print("Upcoming:");
    for (let idx = 0;  idx < size;  ++idx)
        print( upcoming[idx] );
}

getMythStatus();

