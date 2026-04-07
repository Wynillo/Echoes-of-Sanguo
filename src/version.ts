export const ENGINE_VERSION = '1.2.0';
export const TCG_FORMAT_VERSION = 2;

declare const __ENGINE_BUILD__: string;
export const ENGINE_BUILD: string = typeof __ENGINE_BUILD__ !== 'undefined' ? __ENGINE_BUILD__ : 'dev';
