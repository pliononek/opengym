import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { uid, DAYN } from '../lib/format.js'
import { allExercises, EXIDX } from '../lib/exercises.js'
import { hasKey } from '../lib/nutrition-ai.js'
import { parseAndMatchPlan } from '../lib/plan-ai.js'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { exercisePicker, glyphPicker } from '../sheets.jsx'
import Icon from './Icon.jsx'
import { Thumb } from './Media.jsx'
import { Button, NumberField } from './ui.jsx'

/**
 * Main entry function to launch the AI Plan Import workflow.
 * @param {Object} options
 * @param {string} [options.targetRoutineId] If set, imports into this specific routine.
 * @param {Function} [options.onComplete] Callback when import finishes.
 * @param {Function} options.navigate react-router navigate function.
 */
export function openPlanAiImport({ targetRoutineId = null, onComplete, navigate }) {
  const ui = useUI.getState()

  if (!hasKey()) {
    ui.toast(t('Add your Gemini key in Settings to use AI'))
    if (navigate) navigate('/settings')
    return
  }

  ui.openSheet(close => (
    <PastePlanSheet
      targetRoutineId={targetRoutineId}
      onComplete={onComplete}
      navigate={navigate}
      close={close}
    />
  ))
}

export function PastePlanSheet({ targetRoutineId, onComplete, navigate, close }) {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)

  const existingRoutine = targetRoutineId ? S.routines.find(r => r.id === targetRoutineId) : null
  const [notes, setNotes] = useState('')
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAnalyze = async () => {
    const trimmed = notes.trim()
    if (!trimmed) return

    setLoading(true)
    setError('')

    try {
      const allEx = allExercises(S)
      const { routines } = await parseAndMatchPlan(trimmed, allEx)

      if (!routines || routines.length === 0) {
        throw new Error(t('No workouts found in notes'))
      }

      close()

      openSheet(closePreview => (
        <PlanPreviewSheet
          parsedRoutines={routines}
          targetRoutineId={targetRoutineId}
          replaceExisting={replaceExisting}
          onComplete={onComplete}
          navigate={navigate}
          close={closePreview}
        />
      ))
    } catch (err) {
      console.error('AI plan import error:', err)
      setError(err.message || t('Failed to analyze plan with AI'))
    } finally {
      setLoading(false)
    }
  }

  const samplePlaceholder = targetRoutineId
    ? `Wyciskanie sztangi 4x8 80kg\nWyciskanie hantli skos 3x10 24kg\nWznosy bokiem 4x12\nFrancuz leżąc 3x10`
    : `Poniedziałek - Push:\nWyciskanie sztangi 4x8 80kg\nWyciskanie hantli skos 3x10 24kg\nWznosy bokiem 4x12\nFrancuz leżąc 3x10\n\nŚroda - Pull:\nPodciąganie 4x8\nWiosłowanie hantlem 3x10 30kg\nUginanie ramion z supinacją 3x10\n\nPiątek - Nogi:\nPrzysiady ze sztangą 4x6 100kg\nSuwnica 3x10\nUginanie nóg leżąc 3x12`

  return (
    <>
      <div className="row between" style={{ marginBottom: 4 }}>
        <h3>{targetRoutineId ? t('Paste exercises with AI') : t('Import plan with AI')}</h3>
      </div>
      <div className="muted small" style={{ marginBottom: 12 }}>
        {targetRoutineId
          ? t('Paste your workout notes — AI will detect exercises from the library, sets and reps.')
          : t('Paste your workout notes from your notepad — AI will detect workouts, exercises, sets, reps and schedule.')}
      </div>

      <textarea
        className="input"
        style={{
          width: '100%',
          minHeight: 160,
          fontFamily: 'monospace',
          fontSize: 14,
          lineHeight: 1.4,
          resize: 'vertical',
          boxSizing: 'border-box',
          marginBottom: 10
        }}
        placeholder={samplePlaceholder}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        disabled={loading}
        autoFocus
      />

      {existingRoutine && (
        <label
          className="row"
          style={{
            gap: 8,
            marginBottom: 14,
            cursor: 'pointer',
            fontSize: 14,
            userSelect: 'none'
          }}
        >
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={e => setReplaceExisting(e.target.checked)}
            disabled={loading}
          />
          <span>{t('Replace all existing exercises in this routine')}</span>
        </label>
      )}

      {error && (
        <div
          style={{
            padding: '8px 12px',
            background: 'var(--red-light, rgba(255, 69, 58, 0.12))',
            color: 'var(--red)',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 12
          }}
        >
          {error}
        </div>
      )}

      <Button
        variant="primary"
        icon="sparkles"
        onClick={handleAnalyze}
        disabled={loading || !notes.trim()}
      >
        {loading ? t('AI is analyzing your notes…') : t('Analyze with AI')}
      </Button>

      <div style={{ height: 8 }} />
      <Button variant="ghost" className="dim" onClick={close} disabled={loading}>
        {t('Cancel')}
      </Button>
    </>
  )
}

export function PlanPreviewSheet({
  parsedRoutines,
  targetRoutineId,
  replaceExisting,
  onComplete,
  navigate,
  close
}) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)

  const [routines, setRoutines] = useState(parsedRoutines)

  const setRoutineField = (rIdx, field, val) => {
    setRoutines(prev => {
      const next = [...prev]
      next[rIdx] = { ...next[rIdx], [field]: val }
      return next
    })
  }

  const updateExercise = (rIdx, exIdx, patch) => {
    setRoutines(prev => {
      const next = [...prev]
      const r = { ...next[rIdx] }
      const exList = [...r.exercises]
      exList[exIdx] = { ...exList[exIdx], ...patch }
      r.exercises = exList
      next[rIdx] = r
      return next
    })
  }

  const removeExercise = (rIdx, exIdx) => {
    setRoutines(prev => {
      const next = [...prev]
      const r = { ...next[rIdx] }
      r.exercises = r.exercises.filter((_, i) => i !== exIdx)
      next[rIdx] = r
      return next
    })
  }

  const addCustomEx = (rIdx, exIdx, item) => {
    const id = 'c' + uid()
    const name = item.rawName.trim()
    const bp = item.bp || 'chest'

    update(s => {
      s.customEx = s.customEx || []
      s.customEx.push({
        id,
        n: name,
        bp,
        desc: '',
        tg: '',
        eq: 'custom',
        custom: true
      })
    })

    const customObj = EXIDX[id] || {
      id,
      n: name,
      bp,
      eq: 'custom',
      custom: true
    }

    updateExercise(rIdx, exIdx, {
      matchedEx: customObj,
      unmatched: false
    })

    toast(t('“{0}” created as custom exercise', name))
  }

  const pickExerciseFor = (rIdx, exIdx) => {
    exercisePicker(picked => {
      updateExercise(rIdx, exIdx, {
        matchedEx: picked,
        unmatched: false
      })
    })
  }

  const addExerciseToRoutine = rIdx => {
    exercisePicker(picked => {
      setRoutines(prev => {
        const next = [...prev]
        const r = { ...next[rIdx] }
        r.exercises = [
          ...r.exercises,
          {
            rawName: picked.n,
            searchQuery: picked.n,
            bp: picked.bp,
            matchedEx: picked,
            unmatched: false,
            sets: 3,
            reps: 10,
            weight: 0,
            isSupersetNext: false
          }
        ]
        next[rIdx] = r
        return next
      })
    })
  }

  const handleSave = () => {
    // Check if any exercises are completely unassigned
    for (const r of routines) {
      for (const e of r.exercises) {
        if (e.unmatched && !e.matchedEx) {
          toast(t('Assign or create an exercise for “{0}”', e.rawName))
          return
        }
      }
    }

    if (targetRoutineId) {
      // Modifying existing routine
      const rExercises = routines[0]?.exercises || []
      const preparedEx = []

      for (let i = 0; i < rExercises.length; i++) {
        const item = rExercises[i]
        const exObj = item.matchedEx
        if (!exObj) continue

        const exEntry = {
          id: exObj.id,
          sets: item.sets,
          reps: item.reps,
          weight: item.weight
        }

        preparedEx.push(exEntry)
      }

      // Superset linking: if isSupersetNext was checked
      for (let i = 0; i < rExercises.length - 1; i++) {
        if (rExercises[i].isSupersetNext) {
          const gid = preparedEx[i].sg || 'sg' + uid()
          preparedEx[i].sg = gid
          preparedEx[i + 1].sg = gid
        }
      }

      update(s => {
        const r = s.routines.find(x => x.id === targetRoutineId)
        if (r) {
          if (replaceExisting) {
            r.ex = preparedEx
          } else {
            r.ex = [...r.ex, ...preparedEx]
          }
        }
      })

      toast(t('Exercises added to routine!'))
      close()
      if (onComplete) onComplete()
      return
    }

    // Creating new routines
    const createdRoutineIds = []

    update(s => {
      routines.forEach(r => {
        const rid = uid()
        createdRoutineIds.push(rid)

        const preparedEx = []
        r.exercises.forEach(item => {
          if (item.matchedEx) {
            preparedEx.push({
              id: item.matchedEx.id,
              sets: item.sets,
              reps: item.reps,
              weight: item.weight
            })
          }
        })

        // Superset linking
        for (let i = 0; i < r.exercises.length - 1; i++) {
          if (r.exercises[i].isSupersetNext && preparedEx[i] && preparedEx[i + 1]) {
            const gid = preparedEx[i].sg || 'sg' + uid()
            preparedEx[i].sg = gid
            preparedEx[i + 1].sg = gid
          }
        }

        s.routines.push({
          id: rid,
          name: r.name || t('Routine'),
          emoji: r.emoji || DEFAULT_GLYPH,
          ex: preparedEx
        })

        // Assign to weekly schedule if dayOfWeek specified
        if (typeof r.dayOfWeek === 'number' && r.dayOfWeek >= 0 && r.dayOfWeek <= 6) {
          s.week[r.dayOfWeek] = rid
        }
      })
    })

    toast(t('Plan saved successfully!'))
    close()

    if (createdRoutineIds.length === 1 && navigate) {
      navigate('/plan/r/' + createdRoutineIds[0])
    } else if (navigate) {
      navigate('/plan')
    }

    if (onComplete) onComplete()
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 4 }}>
        <h3>{t('Plan preview')}</h3>
      </div>
      <div className="muted small" style={{ marginBottom: 14 }}>
        {t('Review matched exercises, adjust sets and reps before saving.')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
        {routines.map((r, rIdx) => (
          <div
            key={rIdx}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--sep)',
              borderRadius: 14,
              padding: '12px 14px'
            }}
          >
            {!targetRoutineId && (
              <div
                className="row"
                style={{
                  gap: 10,
                  alignItems: 'center',
                  marginBottom: 12,
                  paddingBottom: 10,
                  borderBottom: '1px solid var(--sep)',
                  flexWrap: 'wrap'
                }}
              >
                <button
                  type="button"
                  className="iconbtn"
                  style={{ width: 34, height: 34, fontSize: 18 }}
                  onClick={() =>
                    glyphPicker(r.emoji, g => setRoutineField(rIdx, 'emoji', g))
                  }
                  title={t('Pick an icon')}
                >
                  <Icon name={glyphOf(r.emoji)} />
                </button>

                <input
                  className="input"
                  style={{
                    flex: 1,
                    fontWeight: 600,
                    fontSize: 16,
                    padding: '6px 10px'
                  }}
                  value={r.name}
                  onChange={e => setRoutineField(rIdx, 'name', e.target.value)}
                  placeholder={t('Routine name')}
                />

                <select
                  className="input"
                  style={{
                    fontSize: 13,
                    padding: '6px 8px',
                    width: 'auto',
                    minWidth: 100
                  }}
                  value={r.dayOfWeek !== null && r.dayOfWeek !== undefined ? r.dayOfWeek : ''}
                  onChange={e =>
                    setRoutineField(
                      rIdx,
                      'dayOfWeek',
                      e.target.value === '' ? null : Number(e.target.value)
                    )
                  }
                >
                  <option value="">{t('No day')}</option>
                  {[1, 2, 3, 4, 5, 6, 0].map(d => (
                    <option key={d} value={d}>
                      {t(DAYN[d])}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.exercises.map((e, exIdx) => {
                const ex = e.matchedEx
                const isLinked = e.isSupersetNext

                return (
                  <div
                    key={exIdx}
                    style={{
                      background: e.unmatched
                        ? 'var(--yellow-light, rgba(255, 159, 10, 0.08))'
                        : 'var(--surface-2)',
                      border: e.unmatched
                        ? '1px solid var(--yellow)'
                        : '1px solid var(--sep)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
                      <div
                        className="row"
                        style={{ gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }}
                        onClick={() => pickExerciseFor(rIdx, exIdx)}
                      >
                        {ex && <Thumb ex={ex} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 15,
                              textTransform: 'capitalize',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {ex ? ex.n : e.rawName}
                          </div>
                          <div className="small dim" style={{ marginTop: 2 }}>
                            {e.unmatched ? (
                              <span style={{ color: 'var(--yellow)', fontWeight: 600 }}>
                                {t('Not in library')} · {e.rawName}
                              </span>
                            ) : (
                              <span>
                                {t(ex.tg || ex.bp)}
                                {e.rawName && e.rawName.toLowerCase() !== ex.n.toLowerCase() && (
                                  <span className="dim"> ({e.rawName})</span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="row" style={{ gap: 4, flex: 'none' }}>
                        <button
                          type="button"
                          className={'iconbtn' + (isLinked ? ' on-ss' : '')}
                          style={{
                            width: 30,
                            height: 28,
                            fontSize: 14,
                            borderRadius: 6,
                            color: isLinked ? 'var(--acc)' : undefined
                          }}
                          title={t('Superset with next exercise')}
                          onClick={() =>
                            updateExercise(rIdx, exIdx, { isSupersetNext: !isLinked })
                          }
                        >
                          <Icon name="link" />
                        </button>
                        <button
                          type="button"
                          className="iconbtn dim"
                          style={{ width: 30, height: 28, fontSize: 13, borderRadius: 6 }}
                          title={t('Remove')}
                          onClick={() => removeExercise(rIdx, exIdx)}
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    </div>

                    {e.unmatched && (
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          flexWrap: 'wrap',
                          marginTop: 2
                        }}
                      >
                        <Button
                          size="sm"
                          variant="tinted"
                          icon="search"
                          onClick={() => pickExerciseFor(rIdx, exIdx)}
                        >
                          {t('Choose similar from library')}
                        </Button>
                        <Button
                          size="sm"
                          variant="tinted"
                          icon="plus"
                          onClick={() => addCustomEx(rIdx, exIdx, e)}
                        >
                          {t('Add as custom exercise')}
                        </Button>
                      </div>
                    )}

                    {/* Numeric parameters: Sets, Reps, Weight */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: 8,
                        marginTop: 4,
                        background: 'var(--surface-3)',
                        padding: '8px 10px',
                        borderRadius: 8,
                        alignItems: 'center'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                          minWidth: 0,
                          alignItems: 'stretch'
                        }}
                      >
                        <span
                          className="small muted"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {t('Sets')}
                        </span>
                        <NumberField
                          className="plan-ai-num"
                          value={e.sets}
                          decimal={false}
                          onChange={v => updateExercise(rIdx, exIdx, { sets: Math.max(1, v) })}
                        />
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                          minWidth: 0,
                          alignItems: 'stretch'
                        }}
                      >
                        <span
                          className="small muted"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {t('Reps')}
                        </span>
                        <NumberField
                          className="plan-ai-num"
                          value={e.reps}
                          decimal={false}
                          onChange={v => updateExercise(rIdx, exIdx, { reps: Math.max(1, v) })}
                        />
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                          minWidth: 0,
                          alignItems: 'stretch'
                        }}
                      >
                        <span
                          className="small muted"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={t('Weight ({0})', S.unit)}
                        >
                          {t('Weight ({0})', S.unit)}
                        </span>
                        <NumberField
                          className="plan-ai-num"
                          value={e.weight}
                          decimal={true}
                          onChange={v => updateExercise(rIdx, exIdx, { weight: Math.max(0, v) })}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}

              <Button
                variant="ghost"
                icon="plus"
                size="sm"
                style={{ marginTop: 4 }}
                onClick={() => addExerciseToRoutine(rIdx)}
              >
                {t('Add exercise')}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button variant="primary" icon="check" onClick={handleSave}>
        {targetRoutineId ? t('Add to routine') : t('Save plan')}
      </Button>

      <div style={{ height: 8 }} />
      <Button variant="ghost" className="dim" onClick={close}>
        {t('Cancel')}
      </Button>
    </>
  )
}
