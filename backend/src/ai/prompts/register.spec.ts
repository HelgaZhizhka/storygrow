import {
  SUTEEV,
  SUTEEV_STYLE_5_6,
  SUTEEV_STYLE_3_4,
  voiceOf,
  renderVoiceForProse,
  renderVoiceChecklist,
} from './register';

describe('SUTEEV_STYLE device catalogue (#407)', () => {
  it('5-6 has the eight voice devices and a top-score threshold of 4', () => {
    expect(SUTEEV_STYLE_5_6.devices).toHaveLength(8);
    expect(SUTEEV_STYLE_5_6.minDevicesForHigh).toBe(4);
    expect(SUTEEV_STYLE_5_6.devices.map((d) => d.key)).toContain('inversion');
  });

  it('3-4 is the simpler, repetition-driven set', () => {
    expect(SUTEEV_STYLE_3_4.minDevicesForHigh).toBe(2);
    expect(SUTEEV_STYLE_3_4.devices.map((d) => d.key)).toContain('echo');
    // no internal-monologue device — that is the tic the band must avoid
    expect(SUTEEV_STYLE_3_4.devices.map((d) => d.key)).not.toContain('bodyFeeling');
  });

  it('SUTEEV profile carries voice per band; voiceOf reads it (spec §8 seam)', () => {
    expect(SUTEEV.id).toBe('suteev');
    expect(voiceOf(SUTEEV, '3-4')).toBe(SUTEEV_STYLE_3_4);
    expect(voiceOf(SUTEEV, '5-6')).toBe(SUTEEV_STYLE_5_6);
  });

  it('every microquote is an illustrative fragment (≤100 chars)', () => {
    for (const style of [SUTEEV_STYLE_5_6, SUTEEV_STYLE_3_4]) {
      for (const device of style.devices) {
        expect(device.examples.length).toBeGreaterThan(0);
        for (const example of device.examples) expect(example.length).toBeLessThanOrEqual(100);
      }
    }
  });

  it('renders the same devices for Prose (cues) and the Judge (numbered checklist)', () => {
    const prose = renderVoiceForProse(SUTEEV_STYLE_5_6);
    const checklist = renderVoiceChecklist(SUTEEV_STYLE_5_6);
    expect(prose).toContain('Инверсия глагол–подлежащее');
    expect(prose).toContain('напр.:');
    expect(checklist).toContain('1. Зачин глаголом');
    expect(checklist).toContain('8. Перечень конкретных вещей');
  });
});
