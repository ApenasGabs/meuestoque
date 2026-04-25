# Componentes Base

Biblioteca de componentes reutilizáveis seguindo o padrão do daisyUI.

## 📋 Índice

- [Button](#button)
- [Badge](#badge)
- [Input](#input)
- [Select](#select)
- [Textarea](#textarea)
- [Checkbox](#checkbox)
- [Radio](#radio)
- [Label](#label)
- [Progress](#progress)
- [Loading](#loading)
- [Alert](#alert)
- [Toast](#toast)
- [Modal](#modal)
- [Fieldset](#fieldset)
- [Skeleton](#skeleton)
- [Join](#join)
- [Dock](#dock)
- [Divider](#divider)
- [Card](#card)
- [NavBar](#navbar)
- [Footer](#footer)

## Button

Componente de botão com múltiplas variantes e tamanhos.

### Props

- `variant`: `'primary' | 'secondary' | 'accent' | 'ghost'` (padrão: `'primary'`)
- `size`: `'sm' | 'md' | 'lg'` (padrão: `'md'`)
- `disabled`: `boolean`
- `className`: `string`
- Todos os atributos padrão de `<button>`

### Exemplo

```tsx
import { Button } from '@/components';

export const MyComponent = () => {
  return (
    <>
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button size="lg">Large Button</Button>
      <Button disabled>Disabled</Button>
    </>
  );
}
```

## Badge

Componente de badge/label para destacar informações.

### Props

- `variant`: `'default' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'` (padrão: `'default'`)
- `size`: `'sm' | 'md' | 'lg'` (padrão: `'md'`)
- `className`: `string`

### Exemplo

```tsx
import { Badge } from '@/components';

export const MyComponent = () => {
  return (
    <>
      <Badge variant="primary">New</Badge>
      <Badge variant="success" size="lg">Approved</Badge>
      <Badge variant="error">Error</Badge>
    </>
  );
}
```

## Input

Componente de input com validação e variantes.

### Props

- `variant`: `'bordered' | 'filled' | 'faded'` (padrão: `'bordered'`)
- `size`: `'sm' | 'md' | 'lg'` (padrão: `'md'`)
- `label`: `string`
- `error`: `string` (exibe mensagem de erro)
- `helperText`: `string` (texto auxiliar)
- Todos os atributos padrão de `<input>`

### Exemplo

```tsx
import { Input } from '@/components';
import { useState } from 'react';

export const MyComponent = () => {
  const [value, setValue] = useState('');

  return (
    <Input
      label="Email"
      placeholder="your@email.com"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      error={value.includes('@') ? '' : 'Invalid email'}
      helperText="We'll never share your email"
    />
  );
}
```

## Textarea

Componente de textarea com validação.

### Props

- `variant`: `'bordered' | 'filled' | 'faded'` (padrão: `'bordered'`)
- `size`: `'sm' | 'md' | 'lg'` (padrão: `'md'`)
- `label`: `string`
- `error`: `string`
- `helperText`: `string`
- `rows`: `number` (padrão: `4`)
- Todos os atributos padrão de `<textarea>`

## Checkbox

Componente de checkbox com label.

### Props

- `label`: `ReactNode`
- `size`: `'sm' | 'md' | 'lg'` (padrão: `'md'`)
- `color`: `'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'` (padrão: `'primary'`)
- Todos os atributos padrão de `<input type="checkbox">`

### Exemplo

```tsx
import { Checkbox } from '@/components';

export const MyComponent = () => {
  return (
    <>
      <Checkbox label="Accept terms" />
      <Checkbox label="Subscribe" color="secondary" />
      <Checkbox label="Disabled" disabled />
    </>
  );
}
```

## Radio

Componente de radio button com label.

### Props

- `label`: `ReactNode`
- `size`: `'sm' | 'md' | 'lg'` (padrão: `'md'`)
- `color`: `'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'` (padrão: `'primary'`)
- Todos os atributos padrão de `<input type="radio">`

## Label

Componente de label.

### Props

- `children`: `ReactNode`
- `required`: `boolean`
- `disabled`: `boolean`
- `size`: `'sm' | 'md' | 'lg'` (padrão: `'md'`)
- Todos os atributos padrão de `<label>`

## Progress

Componente de barra de progresso.

### Props

- `value`: `number` (valor atual)
- `max`: `number` (padrão: `100`)
- `variant`: `'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'` (padrão: `'primary'`)
- `size`: `'sm' | 'md' | 'lg'` (padrão: `'md'`)
- `striped`: `boolean`
- `animated`: `boolean`
- `className`: `string`

### Exemplo

```tsx
import { Progress } from '@/components';

export const MyComponent = () => {
  return (
    <>
      <Progress value={50} />
      <Progress value={75} variant="success" striped animated />
      <Progress value={100} variant="error" size="lg" />
    </>
  );
}
```

## Loading

Componente de spinner/loading com múltiplas variantes.

### Props

- `variant`: `'spinner' | 'dots' | 'bars' | 'ring'` (padrão: `'spinner'`)
- `size`: `'sm' | 'md' | 'lg'` (padrão: `'md'`)
- `color`: `'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'` (padrão: `'primary'`)
- `label`: `string`
- `className`: `string`

### Exemplo

```tsx
import { Loading } from '@/components';

export const MyComponent = () => {
  return (
    <>
      <Loading />
      <Loading variant="dots" label="Carregando..." />
      <Loading variant="bars" size="lg" color="success" />
    </>
  );
}
```

## Alert

Componente de alerta com ícone.

### Props

- `children`: `ReactNode`
- `type`: `'info' | 'success' | 'warning' | 'error'` (padrão: `'info'`)
- `testId`: `string`

### Exemplo

```tsx
import { Alert } from '@/components';

export const MyComponent = () => {
  return (
    <>
      <Alert type="info">Informação</Alert>
      <Alert type="success">Sucesso!</Alert>
      <Alert type="warning">Atenção</Alert>
      <Alert type="error">Erro</Alert>
    </>
  );
}
```

## Divider

Componente de divisor com suporte a texto centralizado.

### Props

- `children`: `ReactNode` (texto do meio)
- `variant`: `'horizontal' | 'vertical'` (padrão: `'horizontal'`)
- `className`: `string`

## Card

Componente de card com composição.

### Props

- `children`: `ReactNode`
- `className`: `string`
- `testId`: `string`

### Sub-componentes

- `CardBody` - Corpo do card
- `CardTitle` - Título do card

### Exemplo

```tsx
import { Card, CardBody, CardTitle } from '@/components';

export const MyComponent = () => {
  return (
    <Card>
      <CardBody centered>
        <CardTitle>Meu Card</CardTitle>
        <p>Conteúdo aqui</p>
      </CardBody>
    </Card>
  );
}
```

## Navbar

Componente de barra de navegação.

### Props

- `title`: `string`
- `children`: `ReactNode` (elementos adicionais)

## Footer

Componente de rodapé.

## 🎨 Usando os componentes

### Importação

```tsx
// Importar componentes individuais
import { Button, Badge, Input } from '@/components';

// Ou do arquivo de índice
import * as Components from '@/components';
```

### Tipagem

Todos os componentes são totalmente tipados com TypeScript e suportam IntelliSense completo.

## Select

Componente de select com variantes e validação, seguindo o padrão do Input.

### Props

- `variant`: `'bordered' | 'filled' | 'faded'` (padrão: `'bordered'`)
- `size`: `'sm' | 'md' | 'lg'` (padrão: `'md'`)
- `label`: `string`
- `error`: `string`
- `helperText`: `string`
- `options`: `Array<{ value: string; label: string }>` (alternativa a children)
- Todos os atributos padrão de `<select>`

### Exemplo

```tsx
import { Select } from '@/components';

export const MyComponent = () => {
  return (
    <>
      <Select label="Unidade" options={[
        { value: 'un', label: 'un' },
        { value: 'kg', label: 'kg' },
        { value: 'L', label: 'L' },
      ]} />
      <Select label="Categoria">
        <option value="a">Opção A</option>
        <option value="b">Opção B</option>
      </Select>
    </>
  );
}
```

## Modal

Componente de modal usando o dialog nativo do HTML com classes daisyUI.

### Props

- `open`: `boolean` (se o modal está visível)
- `onClose`: `() => void`
- `title`: `string`
- `subtitle`: `string`
- `className`: `string`
- `testId`: `string`

### Sub-componentes

- `ModalActions` - Container para botões de ação do modal

### Exemplo

```tsx
import { Modal, ModalActions } from '@/components';
import { Button } from '@/components';

export const MyComponent = () => {
  const [open, setOpen] = useState(false);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Título">
      <p>Conteúdo do modal</p>
      <ModalActions>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button>Confirmar</Button>
      </ModalActions>
    </Modal>
  );
}
```

## Toast

Componente de toast com auto-dismiss usando o padrão daisyUI.

### Props

- `visible`: `boolean`
- `type`: `'info' | 'success' | 'warning' | 'error'` (padrão: `'success'`)
- `position`: posição na tela (padrão: `'toast-top toast-end'`)
- `onDismiss`: `() => void`
- `autoDismissMs`: `number` (padrão: `2500`)
- `testId`: `string`

### Exemplo

```tsx
import { Toast } from '@/components';

export const MyComponent = () => {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Toast visible={!!notice} onDismiss={() => setNotice(null)}>
      {notice}
    </Toast>
  );
}
```

## Fieldset

Componente de fieldset para agrupar campos de formulário.

### Props

- `legend`: `string` (título do grupo)
- `description`: `string`
- `className`: `string`
- Todos os atributos padrão de `<fieldset>`

### Exemplo

```tsx
import { Fieldset } from '@/components';

export const MyComponent = () => {
  return (
    <Fieldset legend="Unidade composta">
      <Checkbox label="Ativar" />
      <Input label="Fator" />
    </Fieldset>
  );
}
```

## Skeleton

Componente de skeleton para estados de loading.

### Props

- `variant`: `'text' | 'circle' | 'rect'` (padrão: `'text'`)
- `width`: `string`
- `height`: `string`
- `lines`: `number` (para variant=text)

### Sub-componentes

- `SkeletonCard` - Skeleton pré-formatado no formato de card

## Join

Componente para agrupar itens com bordas compartilhadas.

### Props

- `direction`: `'horizontal' | 'vertical'` (padrão: `'horizontal'`)
- `className`: `string`

## Dock

Componente de dock (bottom navigation bar).

### Props

- `className`: `string`
- `testId`: `string`

### Sub-componentes

- `DockItem` - Item individual do dock
  - `label`: `string | ReactElement`
  - `active`: `boolean`
  - `badgeCount`: `number`
  - `onClick`: `() => void`
  - `testId`: `string`

## 📦 Estrutura

```
src/components/
├── Alert/
├── Badge/
├── Button/
├── Card/
├── Checkbox/
├── Divider/
├── Dock/
├── ExternalLink/
├── FeatureCard/
├── Fieldset/
├── Footer/
├── Input/
├── Join/
├── Label/
├── Loading/
├── Logo/
├── Modal/
├── Navbar/
├── Progress/
├── Radio/
├── Select/
├── Skeleton/
├── Textarea/
├── Toast/
├── ToolItem/
├── CounterCard/
└── index.ts
```
