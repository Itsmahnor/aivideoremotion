import {useCallback, useState} from 'react';
import type {FieldErrors} from '../domain/validation';
import type {StepId} from '../domain/schemas';
import {useWorkflow} from '../workflow/WorkflowProvider';

/**
 * Errors appear once a field was left (blur) or after the user tried to continue,
 * so people are not shouted at while still typing their first word.
 */
export const useFieldDisplay = (step: StepId, errors: FieldErrors) => {
  const {state} = useWorkflow();
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const attempted = Boolean(state.attempted[step]);
  const error = useCallback((key: string) => (attempted || touched.has(key) ? errors[key] : undefined), [attempted, touched, errors]);
  const touch = useCallback((key: string) => () => setTouched((current) => (current.has(key) ? current : new Set(current).add(key))), []);
  return {error, touch, attempted, count: Object.keys(errors).length};
};
