import { Config } from './interfaces';
import { Environments, Events, Urls } from './enums';
import { Platform } from 'react-native';
import queryString from 'query-string';

interface BuildUrlParams {
  bootstrapToken?: string;
  bootstrapTokens?: string[];
  events: Events[];
  handlers: string[];
}

export function buildUrl(
  config: Config,
  { bootstrapToken, bootstrapTokens, events, handlers }: BuildUrlParams
): string {
  const baseUrl = config.baseUrl ?? (config.environment === Environments.SANDBOX ? Urls.SANDBOX : Urls.PRODUCTION);
  const bt = bootstrapTokens ? bootstrapTokens.join(';') : bootstrapToken;

  const queryParams = {
    bt,
    ...(config.active_flow && { active_flow: config.active_flow }),
    ...(events.length && { events: events.join(',') }),
    ...(handlers.length && { handlers: handlers.join(',') }),
    ...(Platform.OS === 'android' && { is_android_webview: 1 }),
    ...(Platform.OS === 'ios' && { is_ios_webview: 1 }),
    ...(config.initial_screen && { initial_screen: config.initial_screen }),
    ...(config.locale && { locale: config.locale }),
    ...(config.theme && { theme: config.theme })
  };

  return queryString.stringifyUrl({ query: queryParams, url: `${baseUrl}/` });
}
