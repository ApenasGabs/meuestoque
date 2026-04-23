import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { StockFrequency, StockItemRecord, UpsertStockItemInput } from "../lib/webData";
import { Input } from "./Input/Input";

interface StockItemModalProps {
  visible: boolean;
  groupId: string;
  onClose: () => void;
  onSave: (payload: UpsertStockItemInput) => Promise<void>;
  initialItem?: StockItemRecord | null;
  nameSuggestions?: string[];
}

const defaultCategory = "Outros";
const customSelectValue = "__custom__";
const categoryOptions = [
  "Hortifruti",
  "Carnes",
  "Laticinios",
  "Limpeza",
  "Higiene",
  "Graos e secos",
  "Bebidas",
  "Pet",
  "Outros",
];
const unitOptions = ["un", "kg", "g", "L", "ml", "pct", "cx"];

const normalizeUnit = (unit: string): string => unit.trim().toLowerCase();

const convertValueBetweenUnits = (value: number, fromUnit: string, toUnit: string): number => {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (from === to) return value;

  if (from === "g" && to === "kg") return value / 1000;
  if (from === "kg" && to === "g") return value * 1000;

  if (from === "ml" && to === "l") return value / 1000;
  if (from === "l" && to === "ml") return value * 1000;

  return value;
};

export const StockItemModal = ({
  visible,
  groupId,
  onClose,
  onSave,
  initialItem,
  nameSuggestions = [],
}: StockItemModalProps) => {
  const [nome, setNome] = useState("");
  const [categoriaMode, setCategoriaMode] = useState<string>(defaultCategory);
  const [customCategoria, setCustomCategoria] = useState("");
  const [unidadeMode, setUnidadeMode] = useState<string>("un");
  const [customUnidade, setCustomUnidade] = useState("");
  const [quantidade, setQuantidade] = useState("0");
  const [quantidadeMinima, setQuantidadeMinima] = useState("0");
  const [tamanhoPorcao, setTamanhoPorcao] = useState("1");
  const [autoAdicionar, setAutoAdicionar] = useState(false);
  const [autoConsumo, setAutoConsumo] = useState(false);
  const [consumoFrequencia, setConsumoFrequencia] = useState<StockFrequency>("weekly");
  const [consumoValor, setConsumoValor] = useState("0");
  const [consumoUnidade, setConsumoUnidade] = useState("un");
  const [dataCompra, setDataCompra] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const initialCategoria = initialItem?.categoria ?? defaultCategory;
    const initialUnidade = initialItem?.unidade ?? "un";

    setNome(initialItem?.nome ?? "");
    setCategoriaMode(
      categoryOptions.includes(initialCategoria) ? initialCategoria : customSelectValue,
    );
    setCustomCategoria(categoryOptions.includes(initialCategoria) ? "" : initialCategoria);
    setUnidadeMode(unitOptions.includes(initialUnidade) ? initialUnidade : customSelectValue);
    setCustomUnidade(unitOptions.includes(initialUnidade) ? "" : initialUnidade);
    setQuantidade(String(initialItem?.quantidade ?? 0));
    setQuantidadeMinima(String(initialItem?.quantidade_minima ?? 0));
    setTamanhoPorcao(String(initialItem?.tamanho_porcao ?? 1));
    setAutoAdicionar(initialItem?.auto_adicionar_lista ?? false);
    const initialConsumoValor = initialItem?.consumo_valor ?? 0;
    setAutoConsumo(initialConsumoValor > 0);
    setConsumoFrequencia(initialItem?.consumo_frequencia ?? "weekly");
    setConsumoValor(String(initialConsumoValor));
    setConsumoUnidade(initialUnidade);
    setDataCompra(initialItem?.data_compra ?? "");
    setDataValidade(initialItem?.data_validade ?? "");
  }, [initialItem, visible]);

  const isValid = useMemo(() => {
    return nome.trim().length > 0;
  }, [nome]);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!isValid) return;

    const resolvedCategoria =
      categoriaMode === customSelectValue
        ? customCategoria.trim() || defaultCategory
        : categoriaMode;
    const resolvedUnidade =
      unidadeMode === customSelectValue ? customUnidade.trim() || "un" : unidadeMode;
    const parsedConsumoValor = Number.parseFloat(consumoValor) || 0;
    const consumoConvertido = autoConsumo
      ? convertValueBetweenUnits(parsedConsumoValor, consumoUnidade, resolvedUnidade)
      : 0;

    setSaving(true);
    try {
      await onSave({
        id: initialItem?.id,
        groupId,
        nome: nome.trim(),
        categoria: resolvedCategoria,
        unidade: resolvedUnidade,
        quantidade: Number.parseFloat(quantidade) || 0,
        quantidadeMinima: Number.parseFloat(quantidadeMinima) || 0,
        tamanhoPorcao: Number.parseFloat(tamanhoPorcao) || 1,
        autoAdicionarLista: autoAdicionar,
        consumoFrequencia,
        consumoValor: consumoConvertido,
        dataCompra: dataCompra || null,
        dataValidade: dataValidade || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-card card" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <h2>{initialItem ? "Editar item" : "Novo item"}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form className="form" onSubmit={(event) => void handleSubmit(event)}>
          <Input
            label="Nome"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            list="stock-item-name-suggestions"
            autoFocus
          />
          <datalist id="stock-item-name-suggestions">
            {nameSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>

          <div className="two-cols">
            <label className="label flex-col items-start gap-2">
              <span className="label-text text-base-content">Categoria</span>
              <select
                className="select select-bordered w-full text-base-content"
                value={categoriaMode}
                onChange={(event) => {
                  const selected = event.target.value;
                  setCategoriaMode(selected);
                }}
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
                <option value={customSelectValue}>Outra (digitar)</option>
              </select>
              {categoriaMode === customSelectValue && (
                <Input
                  value={customCategoria}
                  onChange={(event) => setCustomCategoria(event.target.value)}
                  placeholder="Digite uma nova categoria"
                />
              )}
            </label>
            <label className="label flex-col items-start gap-2">
              <span className="label-text text-base-content">Unidade</span>
              <select
                className="select select-bordered w-full text-base-content"
                value={unidadeMode}
                onChange={(event) => {
                  const selected = event.target.value;
                  setUnidadeMode(selected);
                  if (selected !== customSelectValue) {
                    setConsumoUnidade(selected);
                  }
                }}
              >
                {unitOptions.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
                <option value={customSelectValue}>Outra (digitar)</option>
              </select>
              {unidadeMode === customSelectValue && (
                <Input
                  value={customUnidade}
                  onChange={(event) => setCustomUnidade(event.target.value)}
                  placeholder="Digite uma nova unidade"
                />
              )}
            </label>
          </div>

          <div className="two-cols">
            <Input
              label="Quantidade atual"
              value={quantidade}
              inputMode="decimal"
              onChange={(event) => setQuantidade(event.target.value)}
            />
            <Input
              label="Quantidade minima"
              value={quantidadeMinima}
              inputMode="decimal"
              onChange={(event) => setQuantidadeMinima(event.target.value)}
            />
          </div>

          <div className="two-cols">
            <Input
              label="Data da compra"
              type="date"
              value={dataCompra}
              onChange={(event) => setDataCompra(event.target.value)}
            />
            <Input
              label="Data de validade (opcional)"
              type="date"
              value={dataValidade}
              onChange={(event) => setDataValidade(event.target.value)}
            />
          </div>

          <div className="two-cols">
            <Input
              label="Passo da porcao"
              value={tamanhoPorcao}
              inputMode="decimal"
              onChange={(event) => setTamanhoPorcao(event.target.value)}
            />
            <label className="label cursor-pointer mt-6">
              <span className="label-text text-base-content">Consumo automatico</span>
              <input
                className="toggle"
                type="checkbox"
                checked={autoConsumo}
                onChange={(event) => setAutoConsumo(event.target.checked)}
              />
            </label>
          </div>

          {autoConsumo && (
            <>
              <div className="two-cols">
                <Input
                  label="Consumo por periodo"
                  value={consumoValor}
                  inputMode="decimal"
                  onChange={(event) => setConsumoValor(event.target.value)}
                />
                <label className="label flex-col items-start gap-2">
                  <span className="label-text text-base-content">Unidade do consumo</span>
                  <select
                    className="select select-bordered w-full text-base-content"
                    value={consumoUnidade}
                    onChange={(event) => setConsumoUnidade(event.target.value)}
                  >
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="label flex-col items-start gap-2">
                <span className="label-text text-base-content">Frequencia de consumo</span>
                <select
                  className="select select-bordered w-full text-base-content"
                  value={consumoFrequencia}
                  onChange={(event) => setConsumoFrequencia(event.target.value as StockFrequency)}
                >
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </label>
            </>
          )}

          <label className="label cursor-pointer mt-2">
            <span
              className="label-text text-base-content"
              style={{ WebkitTextFillColor: "currentColor" }}
            >
              Auto adicionar na lista
            </span>
            <input
              className="checkbox"
              type="checkbox"
              checked={autoAdicionar}
              onChange={(event) => setAutoAdicionar(event.target.checked)}
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={!isValid || saving}>
            {saving ? "Salvando..." : "Salvar item"}
          </button>
        </form>
      </div>
    </div>
  );
};
