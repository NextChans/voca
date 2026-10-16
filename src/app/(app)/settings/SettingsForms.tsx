'use client';

import { useActionState, useState } from 'react';
import {
  cancelTestAction,
  createInviteAction,
  createLearnerLoginAction,
  removeLearnerLoginAction,
  resetLearnerPasswordAction,
  setPinAction,
  unlockParentAction,
  updateLearnerAction,
  type ActionState,
} from '@/app/actions';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';
import type { Learner } from '@/lib/server/repo';
import { AvatarPicker } from '../profiles/AddLearnerForm';

const initial: ActionState = {};

export function UnlockForm({ next }: { next: string }) {
  const [state, action] = useActionState(unlockParentAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="unlock_pin" className="label">
          부모 PIN
        </label>
        <input
          id="unlock_pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={8}
          required
          className="input text-center text-2xl tracking-[0.5em]"
        />
      </div>
      <SubmitButton className="btn-primary w-full py-3 text-base" pendingText="확인 중…">
        🔓 잠금 해제
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function SetPinForm({ hasPin }: { hasPin: boolean }) {
  const [state, action] = useActionState(setPinAction, initial);
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="new_pin" className="label">
            새 PIN (숫자 4~8자리)
          </label>
          <input
            id="new_pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4,8}"
            minLength={4}
            maxLength={8}
            autoComplete="new-password"
            required
            className="input"
          />
        </div>
        <div>
          <label htmlFor="confirm_pin" className="label">
            PIN 확인
          </label>
          <input
            id="confirm_pin"
            name="confirm"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4,8}"
            minLength={4}
            maxLength={8}
            autoComplete="new-password"
            required
            className="input"
          />
        </div>
      </div>
      <SubmitButton pendingText="저장 중…">{hasPin ? 'PIN 변경' : 'PIN 설정'}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function LearnerSettingsForm({ learner }: { learner: Learner }) {
  const [state, action] = useActionState(updateLearnerAction, initial);
  const [avatar, setAvatar] = useState(learner.avatar);
  const id = (f: string) => `${f}-${learner.id}`;
  return (
    <form action={action} className="space-y-3" aria-label={`${learner.name} 설정`}>
      <input type="hidden" name="learnerId" value={learner.id} />
      <h3 className="text-base font-bold">
        <span aria-hidden>{avatar}</span> {learner.name}
      </h3>
      <div>
        <label htmlFor={id('name')} className="label">
          이름
        </label>
        <input id={id('name')} name="name" defaultValue={learner.name} required maxLength={20} className="input" />
      </div>
      <AvatarPicker value={avatar} onChange={setAvatar} idPrefix={id('avatar')} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={id('weekly')} className="label">
            주간 시험 횟수
          </label>
          <input
            id={id('weekly')}
            name="weekly_limit"
            type="number"
            inputMode="numeric"
            min={1}
            max={14}
            defaultValue={learner.weekly_limit ?? 2}
            required
            className="input"
            aria-describedby={id('weekly-hint')}
          />
          <p id={id('weekly-hint')} className="mt-1 text-xs text-slate-400">
            1~14회 (기본 2회)
          </p>
        </div>
        <div>
          <label htmlFor={id('min')} className="label">
            최소 출제 단어 수
          </label>
          <input
            id={id('min')}
            name="min_test_words"
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            defaultValue={learner.min_test_words ?? 50}
            required
            className="input"
            aria-describedby={id('min-hint')}
          />
          <p id={id('min-hint')} className="mt-1 text-xs text-slate-400">
            1~200개 (기본 50개)
          </p>
        </div>
      </div>
      <SubmitButton pendingText="저장 중…">저장</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function CancelTestButton({ testId, learnerName }: { testId: string; learnerName: string }) {
  const [state, action] = useActionState(cancelTestAction.bind(null, testId), initial);
  return (
    <form
      action={action}
      className="mt-2"
      onSubmit={(e) => {
        if (!confirm(`${learnerName}의 진행 중인 시험을 취소할까요?`)) e.preventDefault();
      }}
    >
      <SubmitButton className="btn-danger" pendingText="취소하는 중…">
        진행 중인 시험 취소
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function InviteCreator() {
  const [state, action] = useActionState(createInviteAction, initial);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!state.secret) return;
    try {
      await navigator.clipboard.writeText(state.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3">
      <form action={action}>
        <SubmitButton className="btn-secondary" pendingText="만드는 중…">
          💌 배우자 초대코드 만들기
        </SubmitButton>
      </form>
      {state.error && <FormMessage state={state} />}
      {state.secret && (
        <div className="rounded-xl border-2 border-dashed border-brand-500 bg-brand-50 p-4 text-center" role="status">
          <p className="text-xs text-slate-500">초대코드 (지금 한 번만 보여요)</p>
          <p className="my-2 select-all font-mono text-3xl font-bold tracking-widest text-brand-700">
            {state.secret}
          </p>
          <button type="button" onClick={copy} className="btn-secondary" aria-live="polite">
            {copied ? '✅ 복사했어요' : '📋 복사하기'}
          </button>
          {state.message && <p className="mt-3 text-sm text-slate-600">{state.message}</p>}
        </div>
      )}
    </div>
  );
}

/** 자녀 로그인 계정 만들기 / 비밀번호 재설정 / 삭제 */
export function LearnerLoginForm({ learner }: { learner: Learner }) {
  const [createState, createAction] = useActionState(createLearnerLoginAction, initial);
  const [resetState, resetAction] = useActionState(resetLearnerPasswordAction, initial);
  const [removeState, setRemoveState] = useState<ActionState>({});
  const [removing, setRemoving] = useState(false);
  const pwFields = (prefix: string) => (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label htmlFor={`${prefix}_pw_${learner.id}`} className="label">
          비밀번호
        </label>
        <input
          id={`${prefix}_pw_${learner.id}`}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          className="input"
        />
      </div>
      <div>
        <label htmlFor={`${prefix}_cf_${learner.id}`} className="label">
          비밀번호 확인
        </label>
        <input
          id={`${prefix}_cf_${learner.id}`}
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          className="input"
        />
      </div>
    </div>
  );

  if (!learner.login_id) {
    return (
      <form action={createAction} className="space-y-3">
        <p className="text-sm text-slate-600">
          🔑 {learner.name} 전용 아이디를 만들면 부모님 없이 혼자 로그인할 수 있어요. (부모 기능은 쓸 수 없어요)
        </p>
        <input type="hidden" name="learnerId" value={learner.id} />
        <div>
          <label htmlFor={`login_${learner.id}`} className="label">
            아이디 (영어 소문자·숫자·_ 3~20자)
          </label>
          <input
            id={`login_${learner.id}`}
            name="login_id"
            required
            pattern="[a-z0-9_]{3,20}"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="input"
            placeholder="예: jiwoo"
          />
        </div>
        {pwFields('new')}
        <SubmitButton pendingText="만드는 중…">로그인 계정 만들기</SubmitButton>
        <FormMessage state={createState} />
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        🔑 로그인 아이디: <b className="font-mono">{learner.login_id}</b>
      </p>
      <form action={resetAction} className="space-y-3">
        <input type="hidden" name="learnerId" value={learner.id} />
        {pwFields('reset')}
        <SubmitButton className="btn-secondary" pendingText="바꾸는 중…">
          비밀번호 바꾸기
        </SubmitButton>
        <FormMessage state={resetState} />
      </form>
      <button
        type="button"
        className="btn-ghost text-rose-600"
        disabled={removing}
        onClick={async () => {
          if (!confirm(`${learner.name}의 로그인 계정을 삭제할까요? 단어와 시험 기록은 그대로 남아요.`)) return;
          setRemoving(true);
          setRemoveState(await removeLearnerLoginAction(learner.id));
          setRemoving(false);
        }}
      >
        {removing ? '삭제하는 중…' : '로그인 계정 삭제'}
      </button>
      <FormMessage state={removeState} />
    </div>
  );
}
