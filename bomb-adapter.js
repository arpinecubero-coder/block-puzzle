// ==================== BOMB ADAPTER ====================
// Demo mode: bombs are unlimited. Production: WeChat rewarded video ads.
//
// Usage:
//   import { BA } from './bomb-adapter.js';
//   if (BA.canUseBomb()) { BA.useBomb(); ... }
//   BA.requestBombAd(() => { bombs += 3; });

export const BA = {
  isDemo: true,

  canUseBomb() { return this.isDemo; },

  useBomb() {
    // Demo: no limit. Production: decrements bombsLeft
    return this.isDemo;
  },

  requestBombAd(onSuccess, onFail) {
    if (this.isDemo) { onSuccess(); return; }
    // TODO: WeChat mini-program integration
    // wx.createRewardedVideoAd({ adUnitId: 'xxx' })
    //   .onClose(res => res.isEnded ? onSuccess() : onFail?.())
    if (onFail) onFail();
  },

  getLabel() { return this.isDemo ? '💣 FREE' : '💣 看广告'; },
  getCount() { return this.isDemo ? Infinity : 0; },
};
