import * as ping from './ping';
import * as events from './events';
import * as meta from './meta-guide';
import * as hzv from './hzv';
import * as code from './genshin/code';

export const commands = {
  ping,
  meta,
  events,
  'gi-code': code,
  hzv,
};
