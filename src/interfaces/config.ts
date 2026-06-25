import { Environments } from '../enums/environments';
import { Flows } from '../enums/flows';
import { InitialScreens } from '../enums/initial-screens';
import { Locales } from '../enums/locales';
import { Themes } from '../enums/themes';

export interface Config {
  active_flow?: Flows | null;
  baseUrl?: string;
  environment?: Environments;
  initial_screen?: InitialScreens | null;
  locale?: Locales;
  theme?: Themes;
}
