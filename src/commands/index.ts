import * as ping from './ping';
import * as events from './events';
import * as meta from './meta-guide';
import * as cards from './cards';
import * as code from './genshin/code';

export const commands = {
  ping,
  meta,
  events,
  cards,
  'gi-code': code,
};
