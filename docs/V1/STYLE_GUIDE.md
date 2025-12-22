# Homebase Style Guide

## Overview

This guide defines visual and interaction standards for Homebase's plugin-based architecture. All components follow standardized patterns to maintain consistency and optimize user experience across desktop and mobile devices.

## Design System

### Color Palette

#### Primary Colors
```css
/* Blue (Primary Brand) */
blue-50: #eff6ff    /* Light backgrounds, hover states */
blue-500: #3b82f6   /* Primary buttons, focus rings */
blue-600: #2563eb   /* Brand elements, active states */
blue-700: #1d4ed8   /* Hover states, emphasis */

/* Gray Scale (Interface) */
gray-50: #f9fafb    /* Table headers, disabled backgrounds */
gray-100: #f3f4f6   /* Subtle borders, dividers */
gray-200: #e5e7eb   /* Input borders, card borders */
gray-300: #d1d5db   /* Default borders */
gray-500: #6b7280   /* Secondary text, placeholders */
gray-600: #4b5563   /* Body text */
gray-700: #374151   /* Labels, emphasis */
gray-900: #111827   /* High emphasis text, headings */
```

#### Status Colors
```css
/* Success (Green) */
green-50: #f0fdf4   /* Success button backgrounds */
green-500: #22c55e  /* Success icons, accepted states */
green-700: #15803d  /* Success text */

/* Warning (Yellow) */
yellow-50: #fefce8  /* Warning backgrounds */
yellow-600: #ca8a04 /* Warning text and icons */

/* Error (Red) */
red-50: #fef2f2     /* Error backgrounds */
red-500: #ef4444    /* Error borders, rejected states */
red-600: #dc2626    /* Error text */
```

### Typography

#### Font Sizes (Standardized Hierarchy)
```css
text-xs: 12px       /* Labels, metadata, table data */
text-sm: 14px       /* Body text, content, buttons */
text-base: 16px     /* Form inputs, primary content */
text-2xl: 24px      /* Page titles only */
```

#### Font Weights
```css
font-medium: 500    /* Table headers, emphasis */
font-semibold: 600  /* Section headings, important text */
```

#### Typography Patterns
```typescript
// Page titles
<Heading level={1}>Page Title</Heading>

// Section titles (standardized)
<Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
  Section Title
</Heading>

// Labels and content in views
<div className="text-xs text-gray-500">Label</div>
<div className="text-sm text-gray-900">Content</div>
```

### Spacing

#### Component Spacing (Contact-Standard)
```css
/* Card Structure */
Card padding="sm" className="shadow-none px-0"

/* Section Spacing */
space-y-4: 16px     /* Between major sections */
mb-3: 12px          /* Section heading margin */

/* Grid Spacing (Responsive) */
space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3

/* Page Padding */
p-4 sm:p-8          /* Page content padding */
```

## Component Standards

### Card Structure (Standardized)
```typescript
<Card padding="sm" className="shadow-none px-0">
  <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
    Section Title
  </Heading>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {/* Content */}
  </div>
</Card>
```

### Badge Patterns (NEW - Standardized)

#### Interactive Status/Priority Badges
**Standard Pattern:** Only active badge gets color, others remain neutral

```typescript
// Status/Priority Badge Buttons (Quick Actions)
<div className="mb-4">
  <div className="text-xs font-medium text-gray-700 mb-2">Change Status</div>
  <div className="flex flex-wrap gap-2">
    {STATUS_OPTIONS.map((status) => {
      const isActive = item.status === status;
      
      return (
        <button
          key={status}
          onClick={() => handleStatusChange(status)}
          disabled={isActive}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            isActive 
              ? `${STATUS_COLORS[status]} cursor-default` 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer'
          }`}
        >
          {formatStatusForDisplay(status)}
        </button>
      );
    })}
  </div>
</div>
```

#### Display-Only Badges
```typescript
// Status badge in lists/metadata
<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status]}`}>
  {formatStatusForDisplay(status)}
</span>
```

#### Badge Color Mappings
```typescript
// Task Status Colors
export const TASK_STATUS_COLORS = {
  'not started': 'bg-gray-100 text-gray-800 border-gray-200',
  'in progress': 'bg-blue-100 text-blue-800 border-blue-200',
  'Done': 'bg-green-100 text-green-800 border-green-200',
  'Canceled': 'bg-red-100 text-red-800 border-red-200',
} as const;

// Priority Colors
export const TASK_PRIORITY_COLORS = {
  'Low': 'bg-gray-100 text-gray-700 border-gray-200',
  'Medium': 'bg-yellow-100 text-yellow-800 border-yellow-200', 
  'High': 'bg-red-100 text-red-800 border-red-200',
} as const;
```

### Modal Patterns (NEW - Notification Modals)

#### Success Notification Modal
```typescript
{showNotification && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Action Completed!</h2>
          <p className="text-xs text-gray-500">Context info</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-4">
          Main notification message explaining what happened.
        </p>
        <p className="text-xs text-gray-500 italic">
          Additional helpful information or next steps.
        </p>
      </div>

      {/* Footer */}
      <div className="flex justify-end space-x-3 p-4 border-t border-gray-100">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowNotification(false)}
          className="bg-green-600 hover:bg-green-700"
        >
          Got it!
        </Button>
      </div>
    </div>
  </div>
)}
```

#### Confirmation Modal
```typescript
{showConfirmation && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Confirm Action</h2>
          <p className="text-xs text-gray-500">Item reference</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-4">
          Confirmation question and consequences.
        </p>
        <p className="text-xs text-gray-500 italic">
          Additional context or warnings.
        </p>
      </div>

      {/* Footer */}
      <div className="flex justify-end space-x-3 p-4 border-t border-gray-100">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleConfirm}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Confirm
        </Button>
      </div>
    </div>
  </div>
)}
```

### Content Background Pattern (NEW)

#### Content Section Styling
For distinguishing main content from metadata:

```typescript
// Content section with background
<Card padding="sm" className="shadow-none px-0">
  <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Content</Heading>
  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
    <div className="text-sm text-gray-900 whitespace-pre-wrap">
      {content}
    </div>
  </div>
</Card>
```

### Form Layout (Complete Pattern)
```typescript
<div className="space-y-4">
  <form className="space-y-4">
    {/* Validation Summary */}
    {hasBlockingErrors && (
      <Card padding="sm" className="shadow-none px-0">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
              <ul className="mt-2 text-sm text-red-700">
                {blockingErrors.map((error, index) => (
                  <li key={index}>• {error.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Card>
    )}
    
    {/* Form fields */}
  </form>
</div>
```

### Form Field Patterns
```typescript
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Field Label
  </label>
  <input
    type="text"
    value={value}
    onChange={(e) => updateField('field', e.target.value)}
    className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
      getFieldError('field') ? 'border-red-500' : 'border-gray-300'
    }`}
    required
  />
  {getFieldError('field') && (
    <p className="mt-1 text-sm text-red-600">{getFieldError('field')?.message}</p>
  )}
</div>
```

## Universal Keyboard Navigation

### Required Table Row Attributes
All list components must support keyboard navigation:

```typescript
<tr 
  className="hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset cursor-pointer"
  tabIndex={0}
  data-list-item={JSON.stringify(item)}
  data-plugin-name="plugin-name"
  role="button"
  aria-label={`Open ${item.title}`}
  onClick={() => openForView(item)}
>
```

### Color Themes by Plugin
- **Contacts**: Blue (`hover:bg-blue-50 focus:bg-blue-100 focus:ring-blue-500`)
- **Notes**: Yellow (`hover:bg-yellow-50 focus:bg-yellow-100 focus:ring-yellow-500`)  
- **Estimates**: Blue (`hover:bg-blue-50 focus:bg-blue-100 focus:ring-blue-500`)
- **Tasks**: Blue (`hover:bg-blue-50 focus:bg-blue-100 focus:ring-blue-500`)

### Navigation Features
- **Space Key**: Opens focused item in view mode or closes open panel
- **Arrow Keys**: Navigate up/down through table rows with wrapping
- **Visual Feedback**: Clear focus indicators and hover states

## Cross-Plugin Patterns

### Cross-Plugin Mentions
```typescript
// Notes list with mention display
<td className="px-6 py-4 whitespace-nowrap">
  {note.mentions && note.mentions.length > 0 && (
    <div className="flex flex-col items-start gap-0.5">
      {note.mentions.slice(0, 2).map((mention, index) => (
        <span key={index} className="text-xs text-blue-600">
          @{mention.contactName}
        </span>
      ))}
      {note.mentions.length > 2 && (
        <span className="text-xs text-gray-400">
          +{note.mentions.length - 2} more
        </span>
      )}
    </div>
  )}
</td>

// Mobile mention display
{note.mentions && note.mentions.length > 0 && (
  <div className="flex items-center gap-1 flex-wrap">
    {note.mentions.slice(0, 2).map((mention, index) => (
      <span key={index} className="text-xs text-blue-600">
        @{mention.contactName}
      </span>
    ))}
    {note.mentions.length > 2 && (
      <span className="text-xs text-gray-400">
        +{note.mentions.length - 2} more
      </span>
    )}
  </div>
)}
```

### Empty States
```typescript
// Table empty state
{items.length === 0 ? (
  <tr>
    <td colSpan={columns} className="px-6 py-12 text-center text-gray-400">
      {searchTerm ? 'No items found matching your search.' : 'No items yet. Click "Add Item" to get started.'}
    </td>
  </tr>
) : (
  // Render items
)}
```

## Implementation Checklist

### For New Components
- ✅ Follow Card structure with `shadow-none px-0`
- ✅ Implement mobile-first responsive design with conditional rendering
- ✅ Use standardized typography (`text-xs` labels, `text-sm` content)
- ✅ Include proper error handling and validation summary
- ✅ Add keyboard navigation support with required attributes
- ✅ Use plugin-specific color themes for focus states
- ✅ Implement proper loading and empty states

### For Badge Components
- ✅ Use standardized badge structure: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border`
- ✅ Only active badges get color from color mappings
- ✅ Inactive badges use neutral styling: `bg-white text-gray-700 border-gray-300`
- ✅ Add hover states for interactive badges: `hover:bg-gray-50`
- ✅ Include proper disabled states and cursor styling

### For Modals
- ✅ Use consistent modal structure with header, content, and footer
- ✅ Include proper backdrop: `fixed inset-0 bg-black bg-opacity-50`
- ✅ Center modal: `flex items-center justify-center z-50 p-4`
- ✅ Responsive width: `max-w-md w-full`
- ✅ Consistent padding and borders throughout sections

### For Forms
- ✅ Use responsive grid layout (`space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3`)
- ✅ Implement global form functions with plural naming
- ✅ Add validation summary at top with error icon
- ✅ Include unsaved changes protection
- ✅ Use proper field validation patterns

### For Lists
- ✅ Implement mobile/desktop conditional rendering
- ✅ Add sortable headers with icons where appropriate
- ✅ Include search functionality with proper styling
- ✅ Use alternating row colors and keyboard navigation
- ✅ Add proper empty states with helpful messages

### For Views
- ✅ Use reduced typography hierarchy (`text-sm`, `text-xs`)
- ✅ Section headers with `text-sm font-semibold text-gray-900`
- ✅ Add `hr` dividers between major sections
- ✅ Include cross-plugin references where applicable
- ✅ Add metadata sections with consistent formatting
- ✅ Use content background pattern for main content sections

## Quality Assurance

### Testing Requirements
- **Mobile Testing**: Verify functionality on devices with width < 768px
- **Keyboard Navigation**: Test Tab and Space key navigation
- **Cross-Plugin**: Verify @mentions and navigation work correctly
- **Typography**: Check text sizes match standardized hierarchy
- **Error Handling**: Test validation and loading states
- **Responsive**: Confirm table/card switching works properly
- **Badge Consistency**: Verify all status/priority badges follow standard patterns
- **Modal Behavior**: Test modal opening, closing, and backdrop clicks

### Browser Compatibility
- Chrome 90+ (primary development target)
- Safari 14+ (production requirement)
- Firefox 90+ (supported)
- Mobile Safari and Chrome (full responsive support)

---

**Design Philosophy:** Mobile-first responsive design with consistent patterns  
**Performance:** Optimized components with conditional rendering  
**Accessibility:** Keyboard navigation and screen reader support  
**Maintenance:** Standardized patterns reduce development time

*Use contacts plugin components as reference implementation for all patterns.*