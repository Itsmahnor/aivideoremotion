import {useMemo, type FC} from 'react';
import {Plus, Trash2} from 'lucide-react';
import {AUDIENCES, CTA_TYPES, GOALS, TONES} from '@ai-video-studio/schema';
import {useConfirm} from '../components/ConfirmDialog';
import {Button, fieldId, Notice, Section, SelectField, TextField} from '../components/ui';
import {emptyFeature} from '../domain/defaults';
import type {ProductInfo} from '../domain/schemas';
import {LIMITS, productHints, validateProduct} from '../domain/validation';
import {isScriptOutdated} from '../workflow/machine';
import {useWorkflow} from '../workflow/WorkflowProvider';
import {useFieldDisplay} from './useFieldDisplay';

const label = (value: string) => value.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

const GOAL_LABEL: Record<(typeof GOALS)[number], string> = {
  awareness: 'Awareness: explain what we do',
  signups: 'Sign-ups or free trials',
  demos: 'Book demos or sales calls',
  retention: 'Retention: help customers use it',
};
const CTA_LABEL: Record<(typeof CTA_TYPES)[number], string> = {trial: 'Free trial', demo: 'Book a demo', website: 'Visit website'};

export const ProductStep: FC = () => {
  const {state, dispatch} = useWorkflow();
  const confirm = useConfirm();
  const product = state.config.product;
  const errors = useMemo(() => validateProduct(state.config), [state.config]);
  const hints = useMemo(() => productHints(state.config), [state.config]);
  const {error, touch, attempted, count} = useFieldDisplay('product', errors);

  const set = (patch: Partial<ProductInfo>) => dispatch({type: 'config/update', section: 'product', update: (config) => ({...config, product: {...config.product, ...patch}})});
  const setFeature = (id: string, patch: Partial<ProductInfo['features'][number]>) =>
    dispatch({type: 'config/update', section: 'product', update: (config) => ({...config, product: {...config.product, features: config.product.features.map((f) => (f.id === id ? {...f, ...patch} : f))}})});

  const removeFeature = async (id: string) => {
    const feature = product.features.find((f) => f.id === id);
    const filled = feature && (feature.title.trim() || feature.description.trim());
    if (filled && !(await confirm({title: 'Remove this feature?', body: `"${feature.title.trim() || 'Untitled feature'}" will be removed from the product details.`, confirmLabel: 'Remove feature'}))) return;
    set({features: product.features.filter((f) => f.id !== id)});
  };

  const t = (key: string) => ({id: fieldId(key), error: error(key), onBlur: touch(key)});

  return (
    <>
      {state.script && isScriptOutdated(state) ? (
        <Notice tone="warning" title="These details changed after the script was written">
          The current script and any approval are no longer valid. You will need to regenerate or re-review the script.
        </Notice>
      ) : null}
      {attempted && count > 0 ? (
        <Notice tone="error" live title={`${count} field${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} attention`}>
          Fix the highlighted fields to continue. Your entries are kept.
        </Notice>
      ) : null}

      <Section id="product-basics" title="The product" description="Plain, specific facts work best. The script never invents features, numbers or claims.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField {...t('product.productName')} label="Product or company name" required max={LIMITS.productName.max} value={product.productName} onChange={(v) => set({productName: v})} placeholder="e.g. Flowly" />
          <TextField {...t('product.oneLiner')} label="One-line description" required max={LIMITS.oneLiner.max} value={product.oneLiner} onChange={(v) => set({oneLiner: v})} placeholder="Project management built for small agencies" />
          <TextField
            {...t('product.description')}
            className="sm:col-span-2"
            label="Describe it in your own words"
            multiline
            rows={4}
            max={LIMITS.description.max}
            value={product.description}
            onChange={(v) => set({description: v})}
            hint="Write it the way you would explain it to a customer. This is passed to the script writer as context."
            placeholder="Flowly keeps every client project, task and approval on one board, so small agencies stop chasing updates across email and chat…"
          />
          <TextField
            {...t('product.problem')}
            className="sm:col-span-2"
            label="The problem it solves"
            required
            multiline
            rows={2}
            max={LIMITS.problem.max}
            value={product.problem}
            onChange={(v) => set({problem: v})}
            placeholder="Client work gets lost across chats, spreadsheets and email"
          />
        </div>
      </Section>

      <Section
        id="product-features"
        title="Key features and benefits"
        description={`Between ${LIMITS.features.min} and ${LIMITS.features.max} features. The video shows the ones that best fit your objective.`}
        aside={<span className="text-sm tabular-nums text-muted">{product.features.length}/{LIMITS.features.max}</span>}
      >
        <ol className="space-y-4">
          {product.features.map((feature, index) => (
            <li key={feature.id} className="rounded-xl border border-line bg-sunken/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">Feature {index + 1}</span>
                <Button variant="quiet-danger" size="sm" disabled={product.features.length <= 1} onClick={() => void removeFeature(feature.id)} aria-label={`Remove feature ${index + 1}`}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <TextField {...t(`product.features.${index}.title`)} label="Name" required max={LIMITS.featureTitle.max} value={feature.title} onChange={(v) => setFeature(feature.id, {title: v})} placeholder="Client approvals" />
                <TextField
                  {...t(`product.features.${index}.description`)}
                  label="What it does for the user"
                  required
                  max={LIMITS.featureDescription.max}
                  value={feature.description}
                  onChange={(v) => setFeature(feature.id, {description: v})}
                  placeholder="Clients approve work with one click, no email chains"
                />
              </div>
            </li>
          ))}
        </ol>
        {errors['product.features'] ? <p className="mt-2 text-[13px] text-bad">{errors['product.features']}</p> : null}
        <Button variant="secondary" className="mt-4" disabled={product.features.length >= LIMITS.features.max} onClick={() => set({features: [...product.features, emptyFeature()]})}>
          <Plus className="h-4 w-4" aria-hidden /> Add feature
        </Button>
        <TextField
          {...t('product.benefits')}
          className="mt-6"
          label="Overall benefits"
          multiline
          rows={2}
          max={LIMITS.benefits.max}
          value={product.benefits}
          onChange={(v) => set({benefits: v})}
          placeholder="Fewer status meetings, faster sign-off, clear profit per project"
          hint="What changes for the customer once they use it."
        />
      </Section>

      <Section id="product-audience" title="Audience and objective">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            {...t('product.targetAudience')}
            className="sm:col-span-2"
            label="Target audience"
            required
            max={LIMITS.targetAudience.max}
            value={product.targetAudience}
            onChange={(v) => set({targetAudience: v})}
            placeholder="Founders and project leads at agencies with 5 to 50 people"
          />
          <SelectField
            id={fieldId('product.audienceSegment')}
            label="Closest audience type"
            required
            value={product.audienceSegment}
            onChange={(v) => set({audienceSegment: v as ProductInfo['audienceSegment']})}
            options={AUDIENCES.map((a) => ({value: a, label: label(a)}))}
            hint="Picks the storytelling style the script follows."
          />
          <SelectField
            {...t('product.goal')}
            label="Marketing objective"
            required
            value={product.goal}
            placeholder="Choose an objective…"
            onChange={(v) => set({goal: v as ProductInfo['goal']})}
            options={GOALS.map((g) => ({value: g, label: GOAL_LABEL[g]}))}
          />
          <TextField
            {...t('product.objectiveNotes')}
            label="Objective details"
            max={LIMITS.objectiveNotes.max}
            value={product.objectiveNotes}
            onChange={(v) => set({objectiveNotes: v})}
            placeholder="Drive trial sign-ups from the homepage"
          />
          <SelectField id={fieldId('product.tone')} label="Writing tone" required value={product.tone} onChange={(v) => set({tone: v as ProductInfo['tone']})} options={TONES.map((x) => ({value: x, label: label(x)}))} />
        </div>
      </Section>

      <Section id="product-cta" title="Call to action" description="Shown on the final scene, exactly as you write it.">
        <div className="grid gap-5 sm:grid-cols-3">
          <SelectField id={fieldId('product.cta.type')} label="Action" required value={product.cta.type} onChange={(v) => set({cta: {...product.cta, type: v as ProductInfo['cta']['type']}})} options={CTA_TYPES.map((c) => ({value: c, label: CTA_LABEL[c]}))} />
          <TextField
            {...t('product.cta.text')}
            label="Button text"
            required
            max={LIMITS.ctaText.max}
            value={product.cta.text}
            warning={hints['product.cta.text']}
            onChange={(v) => set({cta: {...product.cta, text: v}})}
            placeholder="Start your free trial"
          />
          <TextField
            {...t('product.cta.url')}
            label="Link"
            required
            max={LIMITS.ctaUrl.max}
            value={product.cta.url}
            onChange={(v) => set({cta: {...product.cta, url: v}})}
            placeholder="yourapp.com/start"
            inputProps={{inputMode: 'url', autoCapitalize: 'none', spellCheck: false}}
          />
          <TextField
            {...t('product.customerCount')}
            className="sm:col-span-3"
            label="Social proof"
            max={LIMITS.customerCount.max}
            value={product.customerCount}
            onChange={(v) => set({customerCount: v})}
            placeholder="2,000+ agencies"
            hint="Only add this if it is true. Leave it empty otherwise."
          />
        </div>
      </Section>
    </>
  );
};
