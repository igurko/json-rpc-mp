import { isFilledString } from './isFilledString';

export function getOrigin(value: unknown) {
  return isFilledString(value)
    ? value
    : (
        window.location?.ancestorOrigins?.[0] ||
        document.referrer ||
        ''
      ).replace(/\/$/, '');
}
