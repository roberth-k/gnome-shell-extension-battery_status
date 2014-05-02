
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Settings = 
  Convenience.getSettings("org.gnome.shell.extensions.battery_status");

const St = imports.gi.St;
const Main = imports.ui.main;
const UPower = imports.ui.status.power.UPower;
const PowerIndicator = Main.panel.statusArea.aggregateMenu._power;

let label  = null;
let signals = [];
let cfg = {};

let update_callback = null;

function init() {
}

function enable() {
  init_settings();
  
  label = new St.Label();
  
  update_show();
    
  signals.push([PowerIndicator._proxy,
                PowerIndicator._proxy.connect('g-properties-changed',
                                              function () {
                                                update_callback.call(this);
                                              })]);
}

function disable() {
  if (label) {
    PowerIndicator.indicators.remove_child(label);
    label.destroy();
    label = null;
  }
  
  while (signals.length > 0) {
    let [obj, sig] = signals.pop();
    obj.disconnect(sig);
  }
  
  update_callback = null;
}

function restart() {
  disable();
  enable();
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
    displayMode : set('display-mode', 'time'),
    timeMode    : set('time-mode'   , 'canonical'),
    whenFull    : set('when-full'   , 'all'),
    timeStyle   : set('time-style'  , 'ticker'),
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
   return "%d%s%02d%s".format(hrs, hr_chr, hr_mins, min_chr);
 case "flat_minutes":
   return "%d%s".format(mins, min_chr); 
 }
}

function format_percent(per_c) {
  return "%d%%".format(Math.floor(per_c));
}

function format_label(per_c, time_s) {
  switch (cfg.displayMode) {
    case "time":
      return format_time(time_s);
    case "percentage":
    default:
      return format_percent(per_c);
  }
}

function update_show() {
  update_callback = update;
  PowerIndicator.indicators.add(
    label, { y_align: St.Align.MIDDLE, y_fill: false });
  PowerIndicator.indicators.show();
  update();
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
          // sometimes batteries' max capacity is below 100%
          // (e.g. when charge thresholds are in effect)
          text += format_label(per_c, ttf_s);
          break;
        }
        // *fallthrough* in case the battery driver is confused
        // whether it's still charging or not.
      case UPower.DeviceState.FULLY_CHARGED:
        switch (cfg.whenFull) {
          case 'nothing':
            PowerIndicator.indicators.hide();
            update_callback = update_show;
            break;
          case 'all':
            text = format_percent(per_c);
            // *fallthrough*
          case 'icon':
            break;
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

