import type {FC, ReactNode} from 'react';
import {textMetrics, withOpacity} from '../../tokens';
import {useSceneKit} from '../kit';

type Props = {width: number; height: number; /** 0..1, draws the chart line */ progress?: number; /** which stat card glows (0-2) */ highlight?: number};

const STATS = [
  {label: 'Active users', value: '24.8k', delta: '+12%'},
  {label: 'Conversion', value: '3.9%', delta: '+0.6%'},
  {label: 'Revenue', value: '$48.2k', delta: '+9%'},
];
const NAV = ['Overview', 'Projects', 'Reports', 'Team', 'Settings'];
const CHART = 'M0 180 C60 150 90 170 150 120 S260 100 320 80 S450 60 520 30 S580 20 600 10';

/** Stylised product UI drawn only from brand tokens. Shown whenever no screenshot is provided. */
export const MockUI: FC<Props> = ({width, height, progress = 1, highlight = -1}) => {
  const {brand} = useSceneKit();
  const portrait = height > width * 1.1;
  const base = portrait ? {w: 400, h: 800} : {w: 1000, h: 625};
  const scale = Math.min(width / base.w, height / base.h);
  const lineColor = withOpacity(brand.colors.text, 0.1);
  const card = {
    backgroundColor: brand.colors.surface,
    border: `1px solid ${lineColor}`,
    borderRadius: 14,
    boxSizing: 'border-box' as const,
  };
  const bar = (w: number | string, o = 0.12, h = 10): ReactNode => (
    <div style={{backgroundColor: withOpacity(brand.colors.text, o), borderRadius: 6, height: h, width: w}} />
  );

  const statCards = (count: number) =>
    STATS.slice(0, count).map((stat, index) => (
      <div
        key={stat.label}
        style={{
          ...card,
          border: `${highlight === index ? 2 : 1}px solid ${highlight === index ? brand.colors.primary : lineColor}`,
          boxShadow: highlight === index ? `0 0 0 5px ${withOpacity(brand.colors.primary, 0.18)}` : 'none',
          flex: 1,
          padding: 16,
        }}
      >
        <div style={{color: brand.colors.muted, fontSize: 13}}>{stat.label}</div>
        <div style={{fontFamily: brand.fonts.heading, fontSize: 30, fontWeight: textMetrics.fontWeight.bold, marginTop: 6}}>{stat.value}</div>
        <div style={{color: brand.colors.secondary, fontSize: 12, fontWeight: 600, marginTop: 4}}>{stat.delta}</div>
      </div>
    ));

  const chart = (
    <div style={{...card, flex: 1, padding: 16}}>
      <div style={{fontSize: 14, fontWeight: 600, marginBottom: 8}}>Weekly activity</div>
      <svg viewBox="0 0 600 200" preserveAspectRatio="none" style={{height: portrait ? 170 : 150, width: '100%'}}>
        <path d={`${CHART} L600 200 L0 200 Z`} fill={brand.colors.primary} opacity={0.12 * progress} />
        <path d={CHART} fill="none" pathLength={1} stroke={brand.colors.primary} strokeDasharray={1} strokeDashoffset={1 - progress} strokeLinecap="round" strokeWidth={4} />
      </svg>
    </div>
  );

  const rows = (
    <div style={{...card, padding: 14}}>
      {[0, 1, 2].map((index) => (
        <div key={index} style={{alignItems: 'center', display: 'flex', gap: 12, padding: '8px 0'}}>
          <div style={{backgroundColor: [brand.colors.primary, brand.colors.secondary, brand.colors.accent][index], borderRadius: 10, height: 26, width: 26}} />
          {bar(`${48 - index * 9}%`, 0.16, 10)}
          <div style={{flex: 1}} />
          {bar(46, 0.1, 10)}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{backgroundColor: brand.colors.background, height: '100%', overflow: 'hidden', position: 'relative', width: '100%'}}>
      <div
        style={{
          color: brand.colors.text,
          display: 'flex',
          fontFamily: brand.fonts.body,
          height: base.h,
          left: (width - base.w * scale) / 2,
          position: 'absolute',
          top: (height - base.h * scale) / 2,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: base.w,
        }}
      >
        {portrait ? null : (
          <div style={{backgroundColor: brand.colors.surface, borderRight: `1px solid ${withOpacity(brand.colors.text, 0.08)}`, boxSizing: 'border-box', padding: 18, width: 170}}>
            <div style={{alignItems: 'center', display: 'flex', gap: 10, marginBottom: 26}}>
              <div style={{backgroundColor: brand.colors.primary, borderRadius: 9, height: 28, width: 28}} />
              <div style={{fontFamily: brand.fonts.heading, fontSize: 16, fontWeight: 700}}>{brand.name.split(' ')[0]}</div>
            </div>
            {NAV.map((item, index) => (
              <div
                key={item}
                style={{
                  backgroundColor: index === 0 ? withOpacity(brand.colors.primary, 0.14) : 'transparent',
                  borderRadius: 9,
                  color: index === 0 ? brand.colors.primary : brand.colors.muted,
                  fontSize: 14,
                  fontWeight: index === 0 ? 700 : 500,
                  marginBottom: 6,
                  padding: '9px 12px',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        )}
        <div style={{boxSizing: 'border-box', display: 'flex', flex: 1, flexDirection: 'column', gap: 14, padding: portrait ? 18 : 22}}>
          <div style={{alignItems: 'center', display: 'flex', justifyContent: 'space-between'}}>
            <div style={{fontFamily: brand.fonts.heading, fontSize: portrait ? 22 : 24, fontWeight: 700}}>Overview</div>
            <div style={{alignItems: 'center', display: 'flex', gap: 10}}>
              <div style={{...card, borderRadius: 20, color: brand.colors.muted, fontSize: 12, padding: '7px 14px'}}>Search</div>
              <div style={{backgroundColor: brand.colors.accent, borderRadius: '50%', height: 30, width: 30}} />
            </div>
          </div>
          <div style={{display: 'flex', gap: 14}}>{statCards(portrait ? 2 : 3)}</div>
          {chart}
          {rows}
        </div>
      </div>
    </div>
  );
};
