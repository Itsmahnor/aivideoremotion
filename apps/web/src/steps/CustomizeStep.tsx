import {useMemo, type FC, type ReactNode} from 'react';
import {EXPLAINER_SUBTYPES, SCENE_COUNT} from '@ai-video-studio/schema';
import {ColorField} from '../components/ColorField';
import {PaletteStrip, StylePreview} from '../components/StylePreview';
import {LogoUpload, ScreenshotManager} from '../components/Uploads';
import {Badge, ChoiceCards, fieldId, Notice, Section, SelectField, TextField, Toggle} from '../components/ui';
import {STYLE_MOTION} from '../domain/defaults';
import {CAPTION_STYLES, MOTION_STYLES, VISUAL_STYLES, VOICES, type BrandSettings, type ProjectConfig, type VideoSettings} from '../domain/schemas';
import {customizationWarnings, LIMITS, validateCustomization} from '../domain/validation';
import {cn} from '../lib/utils';
import {isApproved} from '../workflow/machine';
import {useWorkflow} from '../workflow/WorkflowProvider';
import {useFieldDisplay} from './useFieldDisplay';

const COLOR_FIELDS: {key: keyof BrandSettings['colors']; label: string; hint: string}[] = [
  {key: 'primary', label: 'Primary', hint: 'Buttons, highlights'},
  {key: 'secondary', label: 'Secondary', hint: 'Background glow'},
  {key: 'accent', label: 'Accent', hint: 'Highlighted words'},
  {key: 'background', label: 'Background', hint: 'Scene base'},
  {key: 'text', label: 'Text', hint: 'Headlines, copy'},
];

const SUBTYPE: Record<(typeof EXPLAINER_SUBTYPES)[number], {title: string; description: string}> = {
  'product-overview': {title: 'Product overview', description: 'What it is, who it is for, why it helps'},
  'problem-solution': {title: 'Problem → solution', description: 'Start with the pain, end with relief'},
  'feature-announcement': {title: 'Feature launch', description: 'Announce something new'},
  'how-it-works': {title: 'How it works', description: 'Walk through the steps'},
};

const STYLE: Record<(typeof VISUAL_STYLES)[number], {title: string; description: string}> = {
  'modern-saas': {title: 'Modern SaaS', description: 'Crisp, product-first, confident'},
  minimal: {title: 'Minimal', description: 'Lots of space, few words'},
  cinematic: {title: 'Cinematic', description: 'Dramatic hook, slow reveals'},
  corporate: {title: 'Corporate', description: 'Measured and trustworthy'},
  playful: {title: 'Playful', description: 'Light, upbeat, bouncy'},
};

const MOTION: Record<(typeof MOTION_STYLES)[number], string> = {
  calm: 'Calm · smooth fades',
  energetic: 'Energetic · quick slides',
  playful: 'Playful · bouncy wipes',
  corporate: 'Corporate · measured fades',
};

const RatioIcon: FC<{ratio: VideoSettings['aspectRatio']}> = ({ratio}) => {
  const size = ratio === '16:9' ? 'h-5 w-9' : ratio === '9:16' ? 'h-9 w-5' : 'h-7 w-7';
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden>
      <span className={cn('rounded-[3px] border-2 border-current text-muted', size)} />
    </span>
  );
};

const NotConnected: FC<{children: ReactNode}> = ({children}) => <Badge tone="warn">{children}</Badge>;

export const CustomizeStep: FC = () => {
  const {state, dispatch, ctx, services} = useWorkflow();
  const {config} = state;
  const {brand, video} = config;
  const errors = useMemo(() => validateCustomization(config, ctx.fonts), [config, ctx.fonts]);
  const warnings = useMemo(() => customizationWarnings(config), [config]);
  const {error, touch, attempted, count} = useFieldDisplay('customize', errors);
  const voiceAvailability = services.voiceover.availability();

  const setBrand = (patch: Partial<BrandSettings>) => dispatch({type: 'config/update', section: 'brand', update: (c: ProjectConfig) => ({...c, brand: {...c.brand, ...patch}})});
  const setVideo = (patch: Partial<VideoSettings>) => dispatch({type: 'config/update', section: 'video', update: (c: ProjectConfig) => ({...c, video: {...c.video, ...patch}})});
  const fontOptions = ctx.fonts.map((name) => ({value: name, label: name}));
  const approved = isApproved(state);

  return (
    <>
      {attempted && count > 0 ? (
        <Notice tone="error" live title={`${count} setting${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} attention`}>
          Fix the highlighted fields to continue.
        </Notice>
      ) : null}
      {approved ? (
        <Notice tone="info" title="Your script is approved">
          Brand and style changes update the preview and need a new render. Changing the format (type, length or aspect ratio) clears the approval.
        </Notice>
      ) : null}

      <Section id="look" title="Style preview" description="Updates as you change colors, fonts and format.">
        <StylePreview config={config} fonts={ctx.fonts} />
      </Section>

      <Section id="brand" title="Brand">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id={fieldId('brand.name')}
            label="Brand name"
            max={LIMITS.brandName.max}
            value={brand.name}
            error={error('brand.name')}
            onBlur={touch('brand.name')}
            onChange={(name) => setBrand({name})}
            placeholder={config.product.productName.trim() || 'Same as product name'}
            hint="Leave empty to use the product name."
          />
          <TextField
            id={fieldId('brand.tone')}
            label="Brand voice"
            max={LIMITS.brandTone.max}
            value={brand.tone}
            error={error('brand.tone')}
            onBlur={touch('brand.tone')}
            onChange={(tone) => setBrand({tone})}
            placeholder="Friendly, clear and confident"
          />
          <div className="sm:col-span-2">
            <LogoUpload />
          </div>
        </div>
      </Section>

      <Section id="colors" title="Colors" description="Any color you like. Use the picker, a HEX code or RGB values." aside={<div className="w-28 pt-1.5"><PaletteStrip colors={brand.colors} /></div>}>
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          {COLOR_FIELDS.map(({key, label, hint}) => (
            <ColorField key={key} id={fieldId(`brand.colors.${key}`)} label={label} hint={hint} value={brand.colors[key]} onChange={(hex) => setBrand({colors: {...brand.colors, [key]: hex}})} />
          ))}
        </div>
        {warnings.length > 0 ? (
          <Notice tone="warning" className="mt-5" title="Readability">
            <ul className="list-disc space-y-1 pl-4">
              {warnings.map((w) => (
                <li key={w.id}>{w.message}</li>
              ))}
            </ul>
            <p className="mt-2">You can keep these colors. Where text would be unreadable, the video switches it to black or white automatically.</p>
          </Notice>
        ) : (
          <p className="mt-4 text-[13px] text-ok">Contrast looks good for text and highlights.</p>
        )}

        <div className="mt-6 border-t border-line pt-5">
          <Toggle id="gradient-on" label="Custom gradient" checked={brand.gradient.enabled} onChange={(enabled) => setBrand({gradient: {...brand.gradient, enabled}})} description="Shown in the style preview and saved with the project." />
          {brand.gradient.enabled ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_minmax(0,1fr)]">
              <ColorField id="gradient-from" label="From" value={brand.gradient.from} onChange={(from) => setBrand({gradient: {...brand.gradient, from}})} />
              <ColorField id="gradient-to" label="To" value={brand.gradient.to} onChange={(to) => setBrand({gradient: {...brand.gradient, to}})} />
              <div>
                <label htmlFor="gradient-angle" className="mb-1.5 block text-sm font-medium text-ink">
                  Angle <span className="tabular-nums text-muted">{brand.gradient.angle}°</span>
                </label>
                <input
                  id="gradient-angle"
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={brand.gradient.angle}
                  onChange={(e) => setBrand({gradient: {...brand.gradient, angle: Number(e.target.value)}})}
                  className="mt-3 w-full accent-[rgb(var(--signal))]"
                />
              </div>
              <div className="h-10 rounded-lg ring-1 ring-line sm:col-span-3" style={{background: `linear-gradient(${brand.gradient.angle}deg, ${brand.gradient.from}, ${brand.gradient.to})`}} aria-hidden />
             
            </div>
          ) : null}
        </div>
      </Section>

      <Section id="format" title="Format">
        <div className="space-y-6">
          <ChoiceCards
            name="aspect"
            legend="Aspect ratio"
            value={video.aspectRatio}
            onChange={(aspectRatio) => setVideo({aspectRatio})}
            options={[
              {value: '16:9', title: '16:9 Landscape', description: 'Website, YouTube', visual: <RatioIcon ratio="16:9" />},
              {value: '9:16', title: '9:16 Vertical', description: 'Reels, Shorts, TikTok', visual: <RatioIcon ratio="9:16" />},
              {value: '1:1', title: '1:1 Square', description: 'Feed posts', visual: <RatioIcon ratio="1:1" />},
            ]}
          />
          <ChoiceCards
            name="duration"
            legend="Length"
            columns="grid-cols-2 sm:grid-cols-4"
            value={String(video.durationSec) as '15' | '30' | '60' | '90'}
            onChange={(v) => setVideo({durationSec: Number(v) as VideoSettings['durationSec']})}
            options={(['15', '30', '60', '90'] as const).map((s) => {
              const [min, max] = SCENE_COUNT[Number(s)]!;
              return {value: s, title: `${s} seconds`, description: `${min}–${max} scenes`};
            })}
          />
          <ChoiceCards
            name="subtype"
            legend="Video type"
            columns="sm:grid-cols-2"
            value={video.subtype}
            onChange={(subtype) => setVideo({subtype})}
            options={EXPLAINER_SUBTYPES.map((value) => ({value, ...SUBTYPE[value]}))}
          />
        </div>
      </Section>

      <Section id="style" title="Visual style, typography and animation">
        <div className="space-y-6">
          <ChoiceCards
            name="visual-style"
            legend="Visual style"
            columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
            value={video.visualStyle}
            onChange={(visualStyle) => setVideo({visualStyle, motionStyle: STYLE_MOTION[visualStyle]})}
            options={VISUAL_STYLES.map((value) => ({value, ...STYLE[value]}))}
          />
          <div className="grid gap-5 sm:grid-cols-3">
            <SelectField id={fieldId('brand.fonts.heading')} label="Heading font" required value={brand.fonts.heading} error={error('brand.fonts.heading')} options={fontOptions} onChange={(heading) => setBrand({fonts: {...brand.fonts, heading}})} />
            <SelectField id={fieldId('brand.fonts.body')} label="Body font" required value={brand.fonts.body} error={error('brand.fonts.body')} options={fontOptions} onChange={(body) => setBrand({fonts: {...brand.fonts, body}})} />
            <SelectField
              id={fieldId('video.motionStyle')}
              label="Animation"
              required
              value={video.motionStyle}
              options={MOTION_STYLES.map((m) => ({value: m, label: MOTION[m]}))}
              onChange={(m) => setVideo({motionStyle: m as VideoSettings['motionStyle']})}
              hint="Set from the visual style. Change it if you like."
            />
          </div>
        </div>
      </Section>

      <Section id="screenshots" title="Product screenshots" description="Optional. Real screenshots make the video feel real. Without them, a stylised interface in your brand colors is shown.">
        <ScreenshotManager errors={errors} showError={error} touch={touch} />
      </Section>

      <Section
        id="audio"
        title="Voice-over and captions"
        description="Choose your preferences now. They are saved with the project."
        aside={voiceAvailability.status === 'unavailable' ? <NotConnected>Not connected yet</NotConnected> : null}
      >
        <div className="space-y-5">
          <Toggle id="vo-on" label="Voice-over narration" checked={video.voiceover.enabled} onChange={(enabled) => setVideo({voiceover: {...video.voiceover, enabled}})} description="Narration text can be written per scene in the script step." />
          {video.voiceover.enabled ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField id="vo-voice" label="Voice" required value={video.voiceover.voice} options={VOICES.map((v) => ({value: v, label: v[0]!.toUpperCase() + v.slice(1)}))} onChange={(voice) => setVideo({voiceover: {...video.voiceover, voice: voice as VideoSettings['voiceover']['voice']}})} />
              <SelectField id="vo-lang" label="Language" required value={video.voiceover.language} options={['English', 'Spanish', 'French', 'German', 'Portuguese'].map((l) => ({value: l, label: l}))} onChange={(language) => setVideo({voiceover: {...video.voiceover, language}})} />
            </div>
          ) : null}
          <Toggle id="cap-on" label="Captions" checked={video.captions.enabled} onChange={(enabled) => setVideo({captions: {...video.captions, enabled}})} description="Burned-in captions of the narration." />
          {video.captions.enabled ? (
            <SelectField id="cap-style" label="Caption style" required value={video.captions.style} options={CAPTION_STYLES.map((s) => ({value: s, label: s[0]!.toUpperCase() + s.slice(1)}))} onChange={(style) => setVideo({captions: {...video.captions, style: style as VideoSettings['captions']['style']}})} />
          ) : null}
          {voiceAvailability.status === 'unavailable' && (video.voiceover.enabled || video.captions.enabled) ? (
            <Notice tone="warning" title="Not included in videos yet">
              No voice-over provider is connected, so rendered videos have no narration or captions. Your on-screen text still tells the whole story.
            </Notice>
          ) : null}
        </div>
      </Section>
    </>
  );
};
