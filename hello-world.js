#!/usr/bin/gjs

var Gtk = imports.gi.Gtk;

// Initialize GTK+
Gtk.init(null, 0);


// Create your window, name it, and connect the "click x to quit" function.
// The word "window" is a JavaScript keyword, so we have to
// call it something different.
var mywindow = new Gtk.Window({type: Gtk.WindowType.TOPLEVEL});
mywindow.title = "Hello World!";
mywindow.connect("destroy", function(){Gtk.main_quit()});


// Add some text to your window
var label = new Gtk.Label({label: "Hello World"});
mywindow.add(label);

// Make the label and the window itself visible to the user
label.show();
mywindow.show();

// Let the user run the app
Gtk.main();

