import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFood } from '../store/useFood.js'
import { useUI } from '../store/useUI.js'
import { todayISO, isoOf, fmtNum, fmtDate } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { entriesOf, dayTotals, goalsOf, hasGoals, ringPct, removeEntry, updateEntry, addFavorite, removeFavorite, isFavorite, getFavoriteMatch } from '../lib/nutrition.js'
import Icon from '../components/Icon.jsx'
import { Button, NumberField } from '../components/ui.jsx'

const shift = (iso, days) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return isoOf(d)
}

const SOURCE = {
  ai: 'AI', photo: 'AI', off: 'Product', manual: 'Manual'
}

// Quick-edit sheet for one entry (grams rescale per-100g, or just correct the totals).
function EditEntrySheet({ iso, entry, close }) {
  const toast = useUI(s => s.toast)
  const [g, setG] = useState(entry.g || 100)
  const [kcal, setKcal] = useState(entry.kcal || 0)
  const [p, setP] = useState(entry.p || 0)
  const [c, setC] = useState(entry.c || 0)
  const [f, setF] = useState(entry.f || 0)

  const [per100, setPer100] = useState(() => {
    if (entry.per100 && (entry.per100.kcal > 0 || entry.per100.p > 0 || entry.per100.c > 0 || entry.per100.f > 0)) {
      return {
        kcal: Number(entry.per100.kcal) || 0,
        p: Number(entry.per100.p) || 0,
        c: Number(entry.per100.c) || 0,
        f: Number(entry.per100.f) || 0,
      }
    }
    const entryG = Number(entry.g) || 0
    if (entryG > 0) {
      const factor = 100 / entryG
      return {
        kcal: Math.round((Number(entry.kcal) || 0) * factor),
        p: Math.round((Number(entry.p) || 0) * factor * 10) / 10,
        c: Math.round((Number(entry.c) || 0) * factor * 10) / 10,
        f: Math.round((Number(entry.f) || 0) * factor * 10) / 10,
      }
    }
    return null
  })

  const onGramsChange = newG => {
    const gVal = typeof newG === 'number' ? newG : parseFloat(newG) || 0
    setG(gVal)
    if (gVal > 0 && per100) {
      const r = gVal / 100
      setKcal(Math.round(per100.kcal * r))
      setP(Math.round(per100.p * r * 10) / 10)
      setC(Math.round(per100.c * r * 10) / 10)
      setF(Math.round(per100.f * r * 10) / 10)
    } else if (gVal > 0 && !per100 && (kcal > 0 || p > 0 || c > 0 || f > 0)) {
      const factor = 100 / gVal
      const derived = {
        kcal: Math.round((Number(kcal) || 0) * factor),
        p: Math.round((Number(p) || 0) * factor * 10) / 10,
        c: Math.round((Number(c) || 0) * factor * 10) / 10,
        f: Math.round((Number(f) || 0) * factor * 10) / 10,
      }
      setPer100(derived)
    }
  }

  const onMacroChange = (setter, key, val) => {
    const numVal = Math.max(0, Number(val) || 0)
    setter(numVal)
    const currentG = Number(g) || 0
    if (currentG > 0) {
      const factor = 100 / currentG
      setPer100(prev => ({
        ...(prev || { kcal: 0, p: 0, c: 0, f: 0 }),
        [key]: key === 'kcal' ? Math.round(numVal * factor) : Math.round(numVal * factor * 10) / 10,
      }))
    }
  }

  const save = () => {
    useFood.getState().update(food => updateEntry(food, iso, entry.id, {
      g: Math.round(g),
      kcal: Math.round(kcal),
      p: Math.round(p * 10) / 10,
      c: Math.round(c * 10) / 10,
      f: Math.round(f * 10) / 10,
      per100: per100 || entry.per100,
    }))
    close()
    toast(t('Saved'))
  }

  const F = ({ label, value, onChange }) => (
    <div className="cfgrow-mini">
      <span className="stp-l">{label}</span>
      <NumberField value={value} onChange={onChange} />
    </div>
  )

  return <>
    <h3>{t('Edit entry')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{entry.name}</div>
    <div className="f-editgrid">
      <F label="g" value={g} onChange={onGramsChange} />
      <F label="kcal" value={kcal} onChange={v => onMacroChange(setKcal, 'kcal', v)} />
      <F label="P" value={p} onChange={v => onMacroChange(setP, 'p', v)} />
      <F label="C" value={c} onChange={v => onMacroChange(setC, 'c', v)} />
      <F label="F" value={f} onChange={v => onMacroChange(setF, 'f', v)} />
    </div>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={save}>{t('Save')}</Button>
    <div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

export default function Food() {
  const nav = useNavigate()
  const food = useFood(s => s.food)
  const toast = useUI(s => s.toast)
  const ui = useUI()
  const [iso, setIso] = useState(todayISO())

  const goals = goalsOf(food) || { kcal: 0, p: 0, c: 0, f: 0 }
  const haveGoals = hasGoals(food)
  const totals = dayTotals(food, iso) || { kcal: 0, p: 0, c: 0, f: 0 }
  const pct = ringPct(food, iso) || 0
  const entries = entriesOf(food, iso) || []
  const R = 91
  const C = 2 * Math.PI * R

  const editEntry = e => ui.openSheet(close => <EditEntrySheet iso={iso} entry={e} close={close} />)
  const delEntry = e => {
    useFood.getState().update(f => removeEntry(f, iso, e.id))
    toast(t('Deleted'))
  }
  const toggleFav = e => {
    const match = getFavoriteMatch(food, e)
    if (match) {
      useFood.getState().update(f => removeFavorite(f, match.id))
      toast(t('Removed from favorites'))
    } else {
      useFood.getState().update(f => addFavorite(f, e))
      toast(t('Added to favorites'))
    }
  }
  const over = pct > 1

  return <div className="narrow">
    <div className="hdr">
      <div><h1>{t('Food')}</h1><div className="sub">{fmtDate(iso, true)}</div></div>
      <button className="iconbtn" onClick={() => nav('/food/add')} aria-label={t('Add food')}><Icon name="plus" /></button>
    </div>

    <div className="fday-nav">
      <button className="iconbtn" onClick={() => setIso(shift(iso, -1))} aria-label="Previous day"><Icon name="chevronLeft" /></button>
      <div className="fday-label">{iso === todayISO() ? t('Today') : fmtDate(iso, true)}</div>
      <button className="iconbtn" onClick={() => setIso(shift(iso, 1))} aria-label="Next day"><Icon name="chevronRight" /></button>
    </div>

    <div className="card">
      {haveGoals ? <>
        <div className="ring-wrap">
          <div className="ring" style={{ color: over ? 'var(--orange)' : 'var(--acc)' }}>
            <svg viewBox="0 0 210 210" aria-hidden="true">
              <circle className="ring-bg" cx="105" cy="105" r={R} />
              <circle className="ring-fg" cx="105" cy="105" r={R}
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct)} />
            </svg>
            <div className="ring-center">
              <div className="ring-value">{fmtNum(totals.kcal)}</div>
              <div className="ring-dim">{t('of {0} kcal', fmtNum(goals.kcal || 0))}{over ? ' · ' + t('over') : ''}</div>
              <div className="ring-label">{t('calories')}</div>
            </div>
          </div>
        </div>
        <div className="macros">
          {[['p', t('Protein')], ['c', t('Carbs')], ['f', t('Fat')]].map(([k, label]) => {
            const v = totals[k] || 0
            const g = goals?.[k] || 0
            const overK = g > 0 && v > g
            return <div key={k} className={'macro' + (overK ? ' over' : '')}>
              <div className="m-l">{label}</div>
              <div className="m-v">{fmtNum(v)}<span className="m-g"> / {g ? fmtNum(g) : '—'} g</span></div>
            </div>
          })}
        </div>
      </> : <>
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="apple" /></span>
          <div className="big" style={{ fontSize: 22 }}>{t('Track your macros')}</div>
        </div>
        <div className="muted small" style={{ marginBottom: 12 }}>{t('Set a daily calorie and macro target in Settings — the ring then shows how today is going.')}</div>
        <Button variant="primary" onClick={() => nav('/settings')}>{t('Set goals in Settings')}</Button>
      </>}
    </div>

    <div className="row between" style={{ marginBottom: 8 }}>
      <h2 style={{ margin: 0, fontSize: 17 }}>{entries.length ? t('Diary') : t('No entries yet')}</h2>
      {entries.length > 0 && <span className="small dim">{fmtNum(totals.kcal)} {t('kcal')}</span>}
    </div>
    {entries.length ? (
      <div className="food-list">
        {[...entries].reverse().map(e => (
          <div key={e.id} className="food-item">
            <span className="f-ic"><Icon name={e.code ? 'apple' : e.source === 'manual' ? 'pencil' : 'sparkles'} /></span>
            <div className="f-main">
              <div className="f-name">{e.name} <span className="f-src">{t(SOURCE[e.source] || 'Manual')}</span></div>
              <div className="f-meta">
                {e.g > 0 ? fmtNum(e.g) + ' g · ' : ''}
                {t('P')} {fmtNum(e.p)} · {t('C')} {fmtNum(e.c)} · {t('F')} {fmtNum(e.f)}
              </div>
            </div>
            <div className="f-cal">{fmtNum(e.kcal)}</div>
            <button
              className="iconbtn"
              style={{
                width: 32,
                height: 30,
                borderRadius: 8,
                fontSize: 14,
                color: isFavorite(food, e) ? 'var(--yellow)' : 'var(--label-3)'
              }}
              onClick={() => toggleFav(e)}
              aria-label={isFavorite(food, e) ? t('Remove from favorites') : t('Add to favorites')}
            >
              <Icon name={isFavorite(food, e) ? 'starFill' : 'star'} />
            </button>
            <button className="iconbtn" style={{ width: 32, height: 30, borderRadius: 8, fontSize: 14 }} onClick={() => editEntry(e)} aria-label={t('Edit')}><Icon name="pencil" /></button>
            <button className="iconbtn" style={{ width: 32, height: 30, borderRadius: 8, fontSize: 14, color: 'var(--red)' }} onClick={() => delEntry(e)} aria-label={t('Delete')}><Icon name="trash" /></button>
          </div>
        ))}
      </div>
    ) : <div className="empty">{t('Tap + to add your first meal — by text, photo, barcode or hand.')}</div>}

    <div style={{ height: 6 }} />
    <Button variant="primary" icon="plus" onClick={() => nav('/food/add')}>{t('Add food')}</Button>
  </div>
}
