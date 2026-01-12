declare global {
  interface Window {
    StringTune: any;
  }
}

const ST = (typeof window !== "undefined" && window.StringTune) || {};

export const StringModule = ST.StringModule;
export const StringObject = ST.StringObject;
export const StringData = ST.StringData;
export const StringContext = ST.StringContext;
export const StringTune = ST.StringTune;

export default ST;
