# Base Components

Reusable component library following daisyUI patterns.

## 📋 Table of Contents

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

Button component with multiple variants and sizes.

### Props

- `variant`: `'primary' | 'secondary' | 'accent' | 'ghost'` (default: `'primary'`)
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)
- `disabled`: `boolean`
- `className`: `string`
- All standard `<button>` attributes

### Example

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

Badge/label component for highlighting information.

### Props

- `variant`: `'default' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'` (default: `'default'`)
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)
- `className`: `string`

### Example

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

Input component with validation and variants.

### Props

- `variant`: `'bordered' | 'filled' | 'faded'` (default: `'bordered'`)
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)
- `label`: `string`
- `error`: `string` (displays error message)
- `helperText`: `string` (auxiliary text)
- All standard `<input>` attributes

### Example

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

Textarea component with validation.

### Props

- `variant`: `'bordered' | 'filled' | 'faded'` (default: `'bordered'`)
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)
- `label`: `string`
- `error`: `string`
- `helperText`: `string`
- `rows`: `number` (default: `4`)
- All standard `<textarea>` attributes

## Checkbox

Checkbox component with label.

### Props

- `label`: `ReactNode`
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)
- `color`: `'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'` (default: `'primary'`)
- All standard `<input type="checkbox">` attributes

### Example

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

Radio button component with label.

### Props

- `label`: `ReactNode`
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)
- `color`: `'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'` (default: `'primary'`)
- All standard `<input type="radio">` attributes

## Label

Label component.

### Props

- `children`: `ReactNode`
- `required`: `boolean`
- `disabled`: `boolean`
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)
- All standard `<label>` attributes

## Progress

Progress bar component.

### Props

- `value`: `number` (current value)
- `max`: `number` (default: `100`)
- `variant`: `'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'` (default: `'primary'`)
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)
- `striped`: `boolean`
- `animated`: `boolean`
- `className`: `string`

### Example

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

Spinner/loading component with multiple variants.

### Props

- `variant`: `'spinner' | 'dots' | 'bars' | 'ring'` (default: `'spinner'`)
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)
- `color`: `'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'` (default: `'primary'`)
- `label`: `string`
- `className`: `string`

### Example

```tsx
import { Loading } from '@/components';

export const MyComponent = () => {
  return (
    <>
      <Loading />
      <Loading variant="dots" label="Loading..." />
      <Loading variant="bars" size="lg" color="success" />
    </>
  );
}
```

## Alert

Alert component with icon.

### Props

- `children`: `ReactNode`
- `type`: `'info' | 'success' | 'warning' | 'error'` (default: `'info'`)
- `testId`: `string`

### Example

```tsx
import { Alert } from '@/components';

export const MyComponent = () => {
  return (
    <>
      <Alert type="info">Information</Alert>
      <Alert type="success">Success!</Alert>
      <Alert type="warning">Attention</Alert>
      <Alert type="error">Error</Alert>
    </>
  );
}
```

## Divider

Divider component with support for centered text.

### Props

- `children`: `ReactNode` (middle text)
- `variant`: `'horizontal' | 'vertical'` (default: `'horizontal'`)
- `className`: `string`

## Card

Card component with composition.

### Props

- `children`: `ReactNode`
- `className`: `string`
- `testId`: `string`

### Sub-components

- `CardBody` - Card body
- `CardTitle` - Card title

### Example

```tsx
import { Card, CardBody, CardTitle } from '@/components';

export const MyComponent = () => {
  return (
    <Card>
      <CardBody centered>
        <CardTitle>My Card</CardTitle>
        <p>Content here</p>
      </CardBody>
    </Card>
  );
}
```

## Navbar

Navigation bar component.

### Props

- `title`: `string`
- `children`: `ReactNode` (additional elements)

## Footer

Footer component.

## 🎨 Using the components

### Importing

```tsx
// Import individual components
import { Button, Badge, Input } from '@/components';

// Or from the index file
import * as Components from '@/components';
```

### Typing

All components are fully typed with TypeScript and support full IntelliSense.

## Select

Select component with variants and validation, following the Input pattern.

### Props

- `variant`: `'bordered' | 'filled' | 'faded'` (default: `'bordered'`)
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)
- `label`: `string`
- `error`: `string`
- `helperText`: `string`
- `options`: `Array<{ value: string; label: string }>` (alternative to children)
- All standard `<select>` attributes

### Example

```tsx
import { Select } from '@/components';

export const MyComponent = () => {
  return (
    <>
      <Select label="Unit" options={[
        { value: 'un', label: 'un' },
        { value: 'kg', label: 'kg' },
        { value: 'L', label: 'L' },
      ]} />
      <Select label="Category">
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </Select>
    </>
  );
}
```

## Modal

Modal component using HTML native dialog with daisyUI classes.

### Props

- `open`: `boolean` (whether the modal is visible)
- `onClose`: `() => void`
- `title`: `string`
- `subtitle`: `string`
- `className`: `string`
- `testId`: `string`

### Sub-components

- `ModalActions` - Container for modal action buttons

### Example

```tsx
import { Modal, ModalActions } from '@/components';
import { Button } from '@/components';

export const MyComponent = () => {
  const [open, setOpen] = useState(false);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Title">
      <p>Modal content</p>
      <ModalActions>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button>Confirm</Button>
      </ModalActions>
    </Modal>
  );
}
```

## Toast

Toast component with auto-dismiss using daisyUI pattern.

### Props

- `visible`: `boolean`
- `type`: `'info' | 'success' | 'warning' | 'error'` (default: `'success'`)
- `position`: screen position (default: `'toast-top toast-end'`)
- `onDismiss`: `() => void`
- `autoDismissMs`: `number` (default: `2500`)
- `testId`: `string`

### Example

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

Fieldset component to group form fields.

### Props

- `legend`: `string` (group title)
- `description`: `string`
- `className`: `string`
- All standard `<fieldset>` attributes

### Example

```tsx
import { Fieldset } from '@/components';

export const MyComponent = () => {
  return (
    <Fieldset legend="Compound unit">
      <Checkbox label="Enable" />
      <Input label="Factor" />
    </Fieldset>
  );
}
```

## Skeleton

Skeleton component for loading states.

### Props

- `variant`: `'text' | 'circle' | 'rect'` (default: `'text'`)
- `width`: `string`
- `height`: `string`
- `lines`: `number` (for variant=text)

### Sub-components

- `SkeletonCard` - Pre-formatted skeleton in card format

## Join

Component to group items with shared borders.

### Props

- `direction`: `'horizontal' | 'vertical'` (default: `'horizontal'`)
- `className`: `string`

## Dock

Dock component (bottom navigation bar).

### Props

- `className`: `string`
- `testId`: `string`

### Sub-components

- `DockItem` - Individual dock item
  - `label`: `string | ReactElement`
  - `active`: `boolean`
  - `badgeCount`: `number`
  - `onClick`: `() => void`
  - `testId`: `string`

## 📦 Structure

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
