import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bone, Brain, ChevronRight, CircleDot, Droplets, Eye, Focus, GitBranch, Hand, Heart, Layers3, Network, PersonStanding, Search, Sparkles, Utensils, Wind, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { displayName, systemName, text, searchText, normalizeSearch, type Locale } from "../client/i18n";
import { SYSTEMS, type Concept, type SystemId } from "./core/anatomy";
import { ControlTooltip } from "./control-tooltip";

interface Props {
  locale: Locale;
  structures: Map<SystemId, Concept[]>;
  visibleIds: ReadonlySet<string>;
  selectedId?: string;
  ready: boolean;
  isOnly: (id: SystemId) => boolean;
  onSystem: (id: SystemId, enabled: boolean) => void;
  onOnly: (id: SystemId) => void;
  onStructure: (structure: Concept, enabled: boolean) => void;
  onInspect: (structure: Concept) => void;
}

// Reuse the application's line icon family with one neutral palette.
const systemIcons: Record<SystemId, LucideIcon> = {
  skeletal: Bone, muscular: Activity, cardiac: Heart, sensory: Eye,
  arterial: GitBranch, venous: Network, nervous: Brain, respiratory: Wind,
  digestive: Utensils, urinary: Droplets, lymphatic: CircleDot,
  endocrine: Sparkles, reproductive: PersonStanding, mammary: Heart,
  integumentary: Hand, connective: Layers3,
};

export default function SystemLayers({ locale, structures, visibleIds, selectedId, ready, isOnly, onSystem, onOnly, onStructure, onInspect }: Props) {
  const [expanded, setExpanded] = useState<SystemId | null>(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(24);
  const listRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const groupRefs = useRef(new Map<SystemId, HTMLDivElement>());
  useEffect(() => {
    if (!expanded) return;
    const list = listRef.current, group = groupRefs.current.get(expanded);
    if (!list || !group) return;
    list.scrollTo({ top: list.scrollTop + group.getBoundingClientRect().top - list.getBoundingClientRect().top,
      behavior: query || matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [expanded, query]);
  const t = (key: string, values: Record<string, string | number> = {}) => text(key, locale, values);
  const children = useMemo(() => (expanded ? structures.get(expanded) ?? [] : [])
    .filter((c) => searchText(c.name, c.id).includes(normalizeSearch(query)))
    .sort((a, b) => displayName(a.name, locale).localeCompare(displayName(b.name, locale), locale)), [structures, expanded, query, locale]);
  const clearFilter = () => {
    setQuery("");
    setLimit(24);
    filterRef.current?.focus();
  };
  return <div ref={listRef} className="system-list" aria-describedby="layer-help">
    {SYSTEMS.filter((s) => structures.has(s.id)).map((system) => {
      const items = structures.get(system.id)!;
      const ids = items.flatMap((c) => c.elements);
      const shown = ids.filter((id) => visibleIds.has(id)).length;
      const name = systemName(system.id, system.name, locale);
      const open = expanded === system.id;
      const Icon = systemIcons[system.id];
      return <div ref={(node) => { if (node) groupRefs.current.set(system.id, node); else groupRefs.current.delete(system.id); }} className={`system-group ${open ? "is-expanded" : ""} ${selectedId && items.some((item) => item.id === selectedId) ? "has-selection" : ""}`} key={system.id}>
        <div className={`system-row ${shown ? "enabled" : ""}`}>
          <button className="system-name" aria-expanded={open} aria-controls={`system-children-${system.id}`} aria-label={t(open ? "Collapse {name} structures" : "Browse {name} structures", { name })}
            onClick={() => { setExpanded(open ? null : system.id); setQuery(""); setLimit(24); }}>
            <ChevronRight size={12} className="system-chevron" aria-hidden="true" />
            <span className="system-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.6} /></span>
            <span className="system-text"><span className="system-label" title={name}>{name}</span>
              <span className="system-count" title={t("{shown} of {total} pieces visible", { shown, total: ids.length })}>{shown && shown < ids.length ? `${shown}/${ids.length}` : ids.length}</span>
            </span>
          </button>
          <ControlTooltip label={t("Show only {name}", { name })} side="right">
            <Button variant="ghost" className="system-only" aria-label={t("Show only {name}", { name })} aria-pressed={isOnly(system.id)} onClick={() => onOnly(system.id)} disabled={!ready}><Focus size={16} aria-hidden="true" /></Button>
          </ControlTooltip>
          <Switch checked={shown > 0} onCheckedChange={(enabled) => onSystem(system.id, enabled)} aria-label={t("Show {name}", { name })} disabled={!ready} />
        </div>
        {open && <section id={`system-children-${system.id}`} className="system-children" aria-label={t("{name} structures", { name })}>
          <div className="structure-filter"><Search size={13} aria-hidden="true" /><input ref={filterRef} value={query} onChange={(e) => { setQuery(e.target.value); setLimit(24); }} placeholder={t("Filter structures")} aria-label={t("Filter {name} structures", { name })}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
              if (event.key === "Escape" && query) {
                event.preventDefault();
                event.stopPropagation();
                clearFilter();
              }
              if (event.key === "Enter" && query.trim() && children.length === 1 && ready) {
                event.preventDefault();
                onInspect(children[0]);
              }
            }} />
            {query && <button className="structure-filter-clear" type="button" aria-label={t("Clear search")} title={t("Clear search")} onClick={clearFilter}><X size={13} aria-hidden="true" /></button>}
          </div>
          <p className="structure-summary"><span role="status">{t("{count} structures", { count: children.length })}</span><span>{t("Click a name to inspect")}</span></p>
          {children.slice(0, limit).map((structure) => {
            const count = structure.elements.filter((id) => visibleIds.has(id)).length;
            const label = displayName(structure.name, locale);
            const selected = structure.id === selectedId;
            return <div className={`structure-row ${count ? "is-visible" : ""} ${selected ? "is-selected" : ""}`} key={structure.id}>
              <button className="structure-name" title={structure.name} aria-current={selected ? "true" : undefined} onClick={() => onInspect(structure)} disabled={!ready}>
                <span>{label}</span>{structure.elements.length > 1 && <small>{count && count < structure.elements.length ? t("{shown} of {total} pieces visible", { shown: count, total: structure.elements.length }) : t("{count} pieces", { count: structure.elements.length })}</small>}
              </button>
              <Switch size="sm" checked={count > 0} onCheckedChange={(enabled) => onStructure(structure, enabled)} aria-label={t("Show structure: {name}", { name: label })} disabled={!ready} />
            </div>;
          })}
          {!children.length && <p className="structure-empty">{t("No matching structures")}</p>}
          {children.length > limit && <Button variant="ghost" className="structure-more" onClick={() => setLimit((n) => n + 24)}>{t("Show more ({count} remaining)", { count: children.length - limit })}</Button>}
        </section>}
      </div>;
    })}
  </div>;
}
