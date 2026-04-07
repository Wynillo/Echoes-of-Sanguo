export const ENGINE_VERSION = '1.2.0';
export const TCG_FORMAT_VERSION = 2;

declare const __ENGINE_BUILD__: string;
export const ENGINE_BUILD: string = typeof __ENGINE_BUILD__ !== 'undefined' ? __ENGINE_BUILD__ : 'dev';

declare const __TCG_FORMAT_BUILD__: string;
export const TCG_FORMAT_BUILD: string = typeof __TCG_FORMAT_BUILD__ !== 'undefined' ? __TCG_FORMAT_BUILD__ : '';

declare const __MOD_BASE_BUILD__: string;
export const MOD_BASE_BUILD: string = typeof __MOD_BASE_BUILD__ !== 'undefined' ? __MOD_BASE_BUILD__ : '';
