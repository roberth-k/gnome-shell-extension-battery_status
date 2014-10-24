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
 * same terms that the “gnome-shell” or “gnome-shell-extensions” software
 * packages are being distributed by The GNOME Project.
 *
 */

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Settings = 
  Convenience.getSettings("org.gnome.shell.extensions.battery_status");

const St = imports.gi.St;
const Main = imports.ui.main;
const UPower = imports.ui.status.power.UPower;
const PowerIndicator = Main.panel.statusArea.aggregateMenu._power;
const ShellConfig = imports.misc.config;

let label   = null;
let signals = [];
let cfg     = {};

let indicators_visible = true;
let label_visible      = false;
let data_method        = "native";

function init() {
}

function enable() {
  init_settings();

  if ("GetDevicesSync" in PowerIndicator._proxy) {
    data_method = "device";
  } else {
    data_method = "native";
  }

  if (cfg.displayMode != 'icon_only') {
    label = new St.Label();
    PowerIndicator.indicators.add(
      label, { y_align: St.Align.MIDDLE, y_fill: false });
    label_visible = true;
  }
  
  update();
    
  signals.push([PowerIndicator._proxy,
                PowerIndicator._proxy.connect('g-properties-changed',
                                              update)]);
}

function disable() {
  PowerIndicator.indicators.show();
  indicators_visible = true;
  
  if (label) {
    PowerIndicator.indicators.remove_child(label);
    label.destroy();
    label = null;
    label_visible = false;
  }
  
  while (signals.length > 0) {
    let [obj, sig] = signals.pop();
    obj.disconnect(sig);
  }
}

function restart() {
  disable();
  enable();
}

function update_visible(option) {
  switch (option) {
  case 'nothing':
    PowerIndicator.indicators.hide();
    indicators_visible = false;
    break;
  case 'icon':
    if (!indicators_visible) {
      PowerIndicator.indicators.show();
      indicators_visible = true;
    }
    if (label) {
      label.hide();
      label_visible = false;
    }
    break;
  case 'all':
    if (!indicators_visible) {
      PowerIndicator.indicators.show();
      indicators_visible = true;
    }
    if (label && !label_visible) {
      label.show();
      label_visible = true;
    }
    break;
  }
}

function init_settings() {
  function set(key, def) {
    signals.push([Settings, Settings.connect("changed::" + key, restart)]);

    switch(typeof(def)) {
    case "boolean":
      return Settings.get_boolean(key);
    default:
      return Settings.get_string(key);
    }
  }

  cfg = {
    displayMode : set('display-mode' , 'time'),
    timeMode    : set('time-mode'    , 'canonical'),
    whenFull    : set('when-full'    , 'all'),
    whenCharging: set('when-charging', 'all'),
    timeStyle   : set('time-style'   , 'ticker'),
  };
}

function format_time(time_s) {
  let mins    = Math.round(time_s / 60);
 
  let hrs     = Math.floor(mins / 60);
  let hr_mins = mins % 60;
 
  let hr_chr  = ':';
  let min_chr = '';
 
  switch (cfg.timeStyle) {
  default:
  case 'ticker':
     break;
  case 'names':
    hr_chr  = "h";
    min_chr = "m";
    break;
  case 'geo':
    hr_chr  = "'";
    min_chr = '"';
    break;
  }
  
  switch (cfg.timeMode) {
  default:
  case "canonical":
    if (cfg.timeStyle == 'ticker' || hrs > 0) {
      return "%d%s%02d%s".format(hrs, hr_chr, hr_mins, min_chr);
    }
    // *fallthrough* 
  case "flat_minutes":
    return "%d%s".format(mins, min_chr); 
  }
}

function format_percent(per_c) {
  return "%d%%".format(Math.ceil(per_c));
}

function format_label(per_c, time_s) {
  switch (cfg.displayMode) {
    case "time":
      return format_time(time_s);
    case "percentage":
      return format_percent(per_c);
    default:
      return "";
  }
}

function read_battery() {
  switch (data_method) {
  default:
  case "native":
    return [PowerIndicator._proxy.TimeToEmpty,
            PowerIndicator._proxy.TimeToFull,
            PowerIndicator._proxy.Percentage,
            PowerIndicator._proxy.IsPresent,
            PowerIndicator._proxy.State];
  case "device":
    let devices = PowerIndicator._proxy.GetDevicesSync();
    let n_devs = 0;
    let is_present = false;
    let tte_s = 0;
    let ttf_s = 0;
    let per_c = 0;
    let out_state = UPower.DeviceState.EMPTY;

    for (let i = 0; i < devices.length; ++i) {
      for (let j = 0; j < devices[i].length; ++j) {
        let [id, type, icon, percent, state, time] = devices[i][j];

        if (type != UPower.DeviceKind.BATTERY) {
          continue;
        }
        
        ++n_devs;

        is_present  = true;
        tte_s      += time;
        ttf_s       = tte_s;
        // Round the total percentage for multiple batteries
        per_c       = ((per_c * (n_devs - 1)) + percent) / n_devs;
        
        // charging > discharging > full > empty
        // Ignore the other states.

        switch (state) {
        case UPower.DeviceState.DISCHARGING:
        case UPower.DeviceState.PENDING_DISCHARGE:
          if (out_state != UPower.DeviceState.CHARGING) {
            out_state = UPower.DeviceState.DISCHARGING;
          }
          break;
        case UPower.DeviceState.CHARGING:
        case UPower.DeviceState.PENDING_CHARGE:
          out_state = UPower.DeviceState.CHARGING;
          break;
        case UPower.DeviceState.FULLY_CHARGED:
          if (out_state != UPower.DeviceState.CHARGING
              && out_state != UPower.DeviceState.DISCHARGING) {
            out_state = UPower.DeviceState.FULLY_CHARGED;
          }
          break;
        default:
          break;
        }
      }
    }

    return [tte_s, ttf_s, per_c, is_present, out_state];
  }
}

function update() {
  let [tte_s, ttf_s, per_c,
       is_present, state] = read_battery();
  
  let text  = "";
  
  if (is_present) {
    switch (state) {
    case UPower.DeviceState.PENDING_CHARGE:
    case UPower.DeviceState.CHARGING:
      if (ttf_s > 0) {
        // sometimes batteries' max capacity is below 100%
        // (e.g. when charge thresholds are in effect)
        update_visible(cfg.whenCharging);
        if (label_visible) {
          text = format_label(per_c, ttf_s);
        }
        break;
      }
      // *fallthrough* in case the battery driver is confused
      // whether it's still charging or not.
    case UPower.DeviceState.FULLY_CHARGED:
      update_visible(cfg.whenFull);
      if (label_visible) {
        text = format_percent(per_c);
      }
      break;
    case UPower.DeviceState.EMPTY:
    case UPower.DeviceState.UNKNOWN:
      text = "--";
      break;
    default:
    case UPower.DeviceState.PENDING_DISCHARGE:
    case UPower.DeviceState.DISCHARGING:
      update_visible('all');
      if (label_visible) {
        text = format_label(per_c, tte_s);
      }
      break;
    }
  }

  if (label && label_visible) {
    label.set_text(text);
  }
}

