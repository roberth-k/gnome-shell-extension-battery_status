/*
 * Gnome Shell Extension: battery_status
 * 
 * (2014) written and maintained by
 *    Roberth Kulbin <roberth@winter-weht.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * Alternatively, you can redistribute and/or modify this program under the
 * same terms that the "gnome-shell" or "gnome-shell-extensions" software
 * packages are being distributed by The GNOME Project.
 *
 */
 
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Settings = 
  Convenience.getSettings("org.gnome.shell.extensions.battery_status");

const Gtk = imports.gi.Gtk;

const Gettext = imports.gettext.domain('battery_status');
const _ = Gettext.gettext;

function init() {
    Convenience.initTranslations("battery_status");
}

function buildPrefsWidget() {
  let vbox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    margin: 20,
    margin_top: 10,
    expand: true,
    spacing: 10,
  });
  
  let options = [
    [ _("Display mode"),
      make_combo('display-mode', 
                 [_("Time"), _("Percentage"), _("Icon only")]) ],
    [ _("Format time as"),
      make_combo('time-mode', 
                 [_("Canonical (h:mm)"),
                  _("Minutes only (mm)")]) ],
    [ _("Style time as"),
      make_combo('time-style', 
                 [_("Canonical (1:30)"),
                  _("Labels (1h30m)"),
                  _("Angular (1'30\")")]) ],
    [ _("When charging, show"),
      make_combo('when-charging', [_("Nothing"),
                                   _("Icon only"),
                                   _("Icon and label")]) ],
    [ _("When battery full, show"),
      make_combo('when-full', [_("Nothing"),
                               _("Icon only"),
                               _("Icon and label")]) ],
  ];
  
  for (var i in options) {
    vbox.add(make_option(options[i][0], options[i][1].call(this)));
  }
  
  vbox.show_all();
  return vbox;
}

function make_combo(pref, values) {
  return function() {
    let combo = new Gtk.ComboBoxText();
    
    for (var i in values) {
      combo.append_text(values[i]);
    }

    combo.set_active(Settings.get_enum(pref));
  
    combo.connect("changed", function () {
      Settings.set_enum(pref, combo.get_active());
    });
  
    return combo;
  }
}

function make_option(text, item) {
  let hbox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
  });

  let label = new Gtk.Label({
    label: text,
    xalign: 0,
  });
  
  hbox.pack_start(label, true, true, 0);
  hbox.add(item);
  
  return hbox;
}

