export type InAppBrowser = {
  open: (url: string) => void | Promise<unknown>;
};
