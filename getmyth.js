#!/usr/bin/gjs

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;


function getMythStatus()
{
    var hours = "??";
    var minutes = "??";
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
}

getMythStatus();

