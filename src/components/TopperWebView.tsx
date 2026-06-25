import { Config } from '../interfaces';
import { EventHandler } from '../types/event-handler';
import { Events } from '../enums';
import { Handler } from '../types/handler';
import { InAppBrowser } from '../types/in-app-browser';
import { Linking, StyleProp, ViewStyle } from 'react-native';
import { WebView, WebViewProps } from 'react-native-webview';
import { buildUrl } from '../build-url';
import React, { useCallback, useEffect, useRef } from 'react';

const DEFAULT_ORIGIN_WHITELIST = ['https://*', 'http://*', 'about:blank', 'about:srcdoc'];
const TOPPER_EVENT_SOURCE = '@topper-web-sdk-event';
const TOPPER_HANDLER_SOURCE = '@topper-web-sdk-handler';
const RESOLVE_HANDLER = 'resolveHandler';

type EventPropName =
  | 'onOrderContinueButtonClicked'
  | 'onOrderPlaced'
  | 'onOrderWalletSendButtonClicked'
  | 'onWidgetContinueButtonClicked';

const EVENT_PROP_BY_NAME: { [key in Events]?: EventPropName } = {
  [Events.ORDER_CONTINUE_BUTTON_CLICKED]: 'onOrderContinueButtonClicked',
  [Events.ORDER_PLACED]: 'onOrderPlaced',
  [Events.ORDER_WALLET_SEND_BUTTON_CLICKED]: 'onOrderWalletSendButtonClicked',
  [Events.WIDGET_CONTINUE_BUTTON_CLICKED]: 'onWidgetContinueButtonClicked'
};

const TOPPER_BRIDGE_SCRIPT = `
(function () {
  if (window.__topperBridgeInstalled) { return; }
  window.__topperBridgeInstalled = true;

  if (!window.opener) {
    try {
      window.opener = {
        postMessage: function (message) {
          window.ReactNativeWebView.postMessage(typeof message === 'string' ? message : JSON.stringify(message));
        }
      };
    } catch (error) {}
  }

  window.addEventListener('message', function (event) {
    if (typeof event.data !== 'string') { return; }

    var parsed;

    try {
      parsed = JSON.parse(event.data);
    } catch (error) {
      return;
    }

    if (parsed && parsed.source === '@topper-web-sdk-handler') {
      window.dispatchEvent(new MessageEvent('message', { data: parsed }));
    }
  });
})();
true;
`;

interface TopperWebViewProps {
  bootstrapToken?: string;
  bootstrapTokens?: string[];
  config?: Config;
  handlers?: { [handlerName: string]: Handler };
  inAppBrowser?: InAppBrowser;
  onEvent?: EventHandler;
  onOrderContinueButtonClicked?: EventHandler;
  onOrderPlaced?: EventHandler;
  onOrderWalletSendButtonClicked?: EventHandler;
  onWidgetContinueButtonClicked?: EventHandler;
  style?: StyleProp<ViewStyle>;
  webViewProps?: Partial<WebViewProps>;
}

type LiveProps = Pick<
  TopperWebViewProps,
  | 'handlers'
  | 'inAppBrowser'
  | 'onEvent'
  | 'onOrderContinueButtonClicked'
  | 'onOrderPlaced'
  | 'onOrderWalletSendButtonClicked'
  | 'onWidgetContinueButtonClicked'
>;

function TopperWebView({
  bootstrapToken,
  bootstrapTokens,
  config,
  handlers,
  inAppBrowser,
  onEvent,
  onOrderContinueButtonClicked,
  onOrderPlaced,
  onOrderWalletSendButtonClicked,
  onWidgetContinueButtonClicked,
  style,
  webViewProps
}: TopperWebViewProps) {
  const webViewRef = useRef<WebView | null>(null);

  const propsRef = useRef<LiveProps>({
    handlers,
    inAppBrowser,
    onEvent,
    onOrderContinueButtonClicked,
    onOrderPlaced,
    onOrderWalletSendButtonClicked,
    onWidgetContinueButtonClicked
  });

  useEffect(() => {
    propsRef.current = {
      handlers,
      inAppBrowser,
      onEvent,
      onOrderContinueButtonClicked,
      onOrderPlaced,
      onOrderWalletSendButtonClicked,
      onWidgetContinueButtonClicked
    };
  });

  const urlRef = useRef('');

  if (!urlRef.current) {
    const events = [
      onOrderContinueButtonClicked && Events.ORDER_CONTINUE_BUTTON_CLICKED,
      onOrderPlaced && Events.ORDER_PLACED,
      onOrderWalletSendButtonClicked && Events.ORDER_WALLET_SEND_BUTTON_CLICKED,
      onWidgetContinueButtonClicked && Events.WIDGET_CONTINUE_BUTTON_CLICKED
    ].filter(Boolean) as Events[];

    urlRef.current = buildUrl(config ?? {}, {
      bootstrapToken: bootstrapTokens?.join(';') ?? bootstrapToken,
      events,
      handlers: handlers ? Object.keys(handlers) : []
    });
  }

  const resolveHandler = useCallback(async (handlerName: string, data?: unknown) => {
    const reply = (payload: unknown) =>
      webViewRef.current?.postMessage(
        JSON.stringify({ name: RESOLVE_HANDLER, payload, source: TOPPER_HANDLER_SOURCE })
      );
    const handler = propsRef.current.handlers?.[handlerName];

    if (!handler) {
      reply({ error: { message: `Handler "${handlerName}" is not registered.`, name: 'Error' } });

      return;
    }

    try {
      reply(await handler(data));
    } catch (error) {
      reply({
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Error'
        }
      });
    }
  }, []);

  const onMessage: (event: { nativeEvent: { data: string } }) => void = useCallback(
    async (event: { nativeEvent: { data: string } }) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);

        if (message?.source === TOPPER_EVENT_SOURCE && message?.name) {
          const propName = EVENT_PROP_BY_NAME[message.name as Events];

          propsRef.current.onEvent?.({ data: message.payload, name: message.name });

          if (propName) {
            propsRef.current[propName]?.({ data: message.payload });
          }
        }

        if (message?.source === TOPPER_HANDLER_SOURCE && message?.name === RESOLVE_HANDLER && message?.payload) {
          await resolveHandler(message.payload.handlerName, message.payload.data);
        }
        // eslint-disable-next-line no-empty
      } catch {}
    },
    [resolveHandler]
  );

  const onOpenWindow = useCallback(async (event: { nativeEvent: { targetUrl: string } }) => {
    const { targetUrl } = event.nativeEvent;

    if (!targetUrl) {
      return;
    }

    try {
      const { inAppBrowser: browser } = propsRef.current;

      if (browser) {
        await browser.open(targetUrl);
      } else {
        await Linking.openURL(targetUrl);
      }
      // eslint-disable-next-line no-empty
    } catch {}
  }, []);

  const { injectedJavaScriptBeforeContentLoaded: userBeforeContentLoaded, ...restWebViewProps } = webViewProps ?? {};
  const injectedJavaScriptBeforeContentLoaded = userBeforeContentLoaded
    ? `${TOPPER_BRIDGE_SCRIPT}\n${userBeforeContentLoaded}`
    : TOPPER_BRIDGE_SCRIPT;

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: urlRef.current }}
      originWhitelist={DEFAULT_ORIGIN_WHITELIST}
      setSupportMultipleWindows
      onOpenWindow={onOpenWindow}
      {...restWebViewProps}
      injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
      onMessage={onMessage}
      style={style}
    />
  );
}

export { TopperWebView };
export type { TopperWebViewProps };
