
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const St = imports.gi.St;
const Main = imports.ui.main;
const UPower = imports.ui.status.power.UPower;
const PowerIndicator = Main.panel.statusArea.aggregateMenu._power;

let label  = null;
let handle = null;

let cfg_displayMode       = "time";
let cfg_timeMode          = "canonical";
let cfg_showWhenFull      = true;
let cfg_showLabelWhenFull = true;

function init() {
}

function enable() {
  if (PowerIndicator._proxy.Type != UPower.DeviceKind.Battery) {
    return;
  }
  
  let settings = 
    Convenience.getSettings("org.gnome.shell.extensions.battery_status");
  
  cfg_displayMode       = settings.get_enum   ("display-mode");
  cfg_timeMode          = settings.get_enum   ("time-mode");
  cfg_showWhenFull      = settings.get_boolean("show-when-full");
  cfg_showLabelWhenFull = settings.get_boolean("show-label-when-full");

  label = new St.Label();
  update();
  
  PowerIndicator.indicators.add(
    label, { y_align: St.Align.MIDDLE, y_fill: false });
    
  handle = PowerIndicator._proxy.connect('g-properties-changed', update);
}

function disable() {
  if (label) {
    PowerIndicator.indicators.remove_child(label);
    label.destroy();
    label = null;
  }
  
  if (handle) {
    PowerIndicator._proxy.disconnect(handle);
    handle = null;
  }
}

function format_time(time_s) {
 let mins    = Math.round(time_s / 60);
  
 let hrs     = Math.floor(mins / 60);
 let hr_mins = mins % 60;
  
 switch (cfg_timeMode) {
 default:
 case "canonical":
   return "%d:%02d".format(hrs, hr_mins);
 }
}

function format_percent(per_c) {
  return "%d%%".format(Math.floor(per_c));
}

function format_label(per_c, time_s) {
  switch (cfg_displayMode) {
    case "time":
      return format_time(time_s);
    case "percentage":
    default:
      return format_percent(per_c);
  }
}

function update() {
  let tte_s = PowerIndicator._proxy.TimeToEmpty;
  let ttf_s = PowerIndicator._proxy.TimeToFull;
  let per_c = PowerIndicator._proxy.Percentage;
  
  let text  = "";
  
  if (PowerIndicator._proxy.IsPresent) {
    switch (PowerIndicator._proxy.State) {
      case UPower.DeviceState.PENDING_CHARGE:
        // probably happens during battery calibration
        text = "...";
        // *fallthrough*
      case UPower.DeviceState.CHARGING:
        if (ttf_s > 0) {
          // sometimes batteries report actual max capacity as below 100%
          text += format_label(per_c, ttf_s);
          break;
        }
        // *fallthrough* in case the battery driver is confused
        // whether it's still charging or not.
      case UPower.DeviceState.FULLY_CHARGED:
        if (cfg_showWhenFull) {
          text = format_percent(per_c);
        }
        break;
      case UPower.DeviceState.EMPTY:
        text = "--";
        break;
      case UPower.DeviceState.UNKNOWN:
        text = "??";
        break;
      case UPower.DeviceState.PENDING_DISCHARGE:
        // probably happens during battery calibration
        text = "...";
        // *fallthrough*
      default:
      case UPower.DeviceState.DISCHARGING:
        text += format_label(per_c, tte_s);
        break;
    }
  }

  label.set_text(text);
}

