# Homebase Style Guide

## Overview

This style guide defines the visual and interaction patterns for Homebase's plugin-based architecture. All components should follow these patterns to maintain consistency across the application.

## Design System

### Color Palette

#### Primary Colors
```css
/* Blue (Primary) */
blue-50: #eff6ff    /* Light backgrounds, selected states */
blue-500: #3b82f6   /* Primary buttons, focus rings */
blue-600: #2563eb   /* Brand elements, icons */
blue-700: #1d4ed8   /* Active states, hover */
blue-800: #1e40af   /* Text on light blue backgrounds */

/* Gray Scale */
gray-50: #f9fafb    /* Table headers, disabled backgrounds */
gray-100: #f3f4f6   /* Borders, dividers */
gray-200: #e5e7eb   /* Input borders, card borders */
gray-300: #d1d5db   /* Default input borders */
gray-400: #9ca3af   /* Icons, placeholder text */
gray-500: #6b7280   /* Secondary text, muted content */
gray-600: #4b5563   /* Body text */
gray-700: #374151   /* Headings, labels */
gray-800: #1f2937   /* Primary text */
gray-900: #111827   /* High emphasis text */
```

#### Status Colors
```css
/* Success/Green */
green-100: #dcfce7  /* Success background */
green-500: #22c55e  /* Success icons */
green-600: #16a34a  /* Success text */
green-800: #166534  /* Success emphasis */

/* Warning/Yellow */
yellow-50: #fefce8  /* Warning background */
yellow-100: #fef3c7 /* Warning background */
yellow-600: #ca8a04 /* Warning text */
yellow-700: #a16207 /* Warning emphasis */

/* Error/Red */
red-50: #fef2f2     /* Error background */
red-200: #fecaca    /* Error border */
red-400: #f87171    /* Error icons */
red-500: #ef4444    /* Error borders */
red-600: #dc2626    /* Error text */
red-700: #b91c1c    /* Error emphasis */
red-800: #991b1b    /* Error on light backgrounds */
```

### Typography

#### Font Sizes
```css
text-xs: 12px       /* Captions, badges, meta info */
text-sm: 14px       /* Body text, table cells, buttons */
text-base: 16px     /* Form inputs, primary content */
text-lg: 18px       /* Subheadings */
text-xl: 20px       /* Section headings */
text-2xl: 24px      /* Page titles */
```

#### Font Weights
```css
font-medium: 500    /* Labels, table headers, emphasis */
font-semibold: 600  /* Headings, important text */
font-bold: 700      /* Major headings (rare) */
```

#### Line Heights
```css
leading-tight: 1.25 /* Headings */
leading-normal: 1.5 /* Body text, paragraphs */
```

### Spacing

#### Padding & Margins
```css
/* Component Spacing */
p-4: 16px          /* Card padding (mobile) */
p-6: 24px          /* Card padding (desktop), form padding */
px-3: 12px         /* Input horizontal padding */
py-1.5: 6px        /* Input vertical padding */
py-2: 8px          /* Textarea padding */
mb-1: 4px          /* Label margin bottom */
mb-3: 12px         /* Section spacing */
gap-3: 12px        /* Grid gaps */
space-y-3: 12px    /* Vertical spacing between elements */
space-y-4: 16px    /* Section spacing */
```

#### Layout Spacing
```css
/* Page Layout */
p-4: 16px          /* Mobile page padding */
p-6: 24px          /* Desktop page padding */
mb-6: 24px         /* Page header margin */
mb-8: 32px         /* Large section spacing */
```

## Components

### Buttons

#### Variants
```tsx
// Primary - Main actions
<Button variant="primary" icon={Plus}>Save</Button>
// Classes: bg-blue-500 text-white hover:bg-blue-600

// Secondary - Secondary actions  
<Button variant="secondary" icon={Edit}>Edit</Button>
// Classes: bg-gray-100 text-gray-700 hover:bg-gray-200

// Danger - Destructive actions
<Button variant="danger" icon={Trash2}>Delete</Button>
// Classes: bg-red-500 text-white hover:bg-red-600

// Ghost - Subtle actions
<Button variant="ghost" icon={Eye}>View</Button>
// Classes: bg-transparent text-gray-600 hover:bg-gray-100
```

#### Sizes
```tsx
// Default size
<Button>Normal Button</Button>

// Small size - for table actions, secondary actions
<Button size="sm">Small Button</Button>
```

### Form Elements

#### Input Fields
```tsx
// Standard input styling
<input
  type="text"
  className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
/>

// Error state
<input
  className="w-full px-3 py-1.5 text-base border border-red-500 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
/>
```

#### Select Dropdowns
```tsx
<select className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
  <option>Option 1</option>
</select>
```

#### Textareas
```tsx
<textarea
  rows={4}
  className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
/>
```

#### Labels
```tsx
<label className="block text-sm font-medium text-gray-700 mb-1">
  Field Label
</label>
```

#### Error Messages
```tsx
// Error text
<p className="mt-1 text-sm text-red-600">This field is required</p>

// Warning text  
<p className="mt-1 text-sm text-yellow-600">Email already exists (Warning)</p>
```

### Cards

#### Standard Card
```tsx
<Card padding="md">
  <Heading level={3} className="mb-3">Section Title</Heading>
  {/* Content */}
</Card>
```

#### Card Classes
```css
/* Card base styling */
.card {
  background: white;
  border: 1px solid #e5e7eb; /* gray-200 */
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* Card padding variants */
padding="md": 16px /* p-4 */
```

### Tables

#### Desktop Table Structure
```tsx
<Card>
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Header
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        <tr className="hover:bg-gray-50">
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm font-medium text-gray-900">Content</div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</Card>
```

#### Table Typography
```css
/* Headers */
text-xs font-medium text-gray-500 uppercase tracking-wider

/* Cell content - primary */
text-sm font-medium text-gray-900

/* Cell content - secondary */
text-sm text-gray-500

/* Cell spacing */
px-6 py-4 /* Standard cell padding */
px-6 py-3 /* Header padding */
```

### Status Badges

#### Badge Variants
```tsx
// Company/Success
<span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
  Company
</span>

// Private/Info
<span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
  Private
</span>

// Draft
<span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
  Draft
</span>

// Sent
<span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
  Sent
</span>

// Accepted
<span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
  Accepted
</span>

// Rejected
<span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
  Rejected
</span>
```

### Error/Validation States

#### Validation Summary
```tsx
<Card padding="md">
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <div className="flex items-center">
      <div className="flex-shrink-0">
        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          {/* Error icon */}
        </svg>
      </div>
      <div className="ml-3">
        <h3 className="text-sm font-medium text-red-800">
          Cannot save item
        </h3>
        <div className="mt-2 text-sm text-red-700">
          <p>Please fix the following errors before saving:</p>
          <ul className="list-disc list-inside mt-1">
            <li>Error message 1</li>
            <li>Error message 2</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</Card>
```

## Layout Patterns

### Form Layout

#### Standard Form Structure
```tsx
<div className="p-6 space-y-4">
  <form className="space-y-4">
    {/* Validation Summary */}
    {hasErrors && <ValidationSummary />}
    
    {/* Form Sections */}
    <Card padding="md">
      <Heading level={3} className="mb-3">Section Title</Heading>
      <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
        {/* Form fields */}
      </div>
    </Card>
  </form>
</div>
```

#### Responsive Grid Pattern
```tsx
// Two-column responsive grid
<div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
  <div>Field 1</div>
  <div>Field 2</div>
</div>

// Full-width field in grid
<div className="md:col-span-2">
  <input className="w-full" />
</div>
```

### List/Table Layout

#### Page Header Pattern
```tsx
<div className="p-4 sm:p-6">
  <div className="mb-6 flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Page Title</h1>
      <p className="text-gray-600">Page description</p>
    </div>
    <Button variant="primary" icon={Plus}>
      Add Item
    </Button>
  </div>
  
  {/* Search and filters */}
  <div className="mb-4 flex items-center gap-4">
    {/* Search input and controls */}
  </div>
  
  {/* Table/List content */}
  <Card>
    {/* Table or card list */}
  </Card>
</div>
```

### Mobile Responsive Patterns

#### Mobile Card List
```tsx
// Mobile-first responsive design
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => setIsMobile(window.innerWidth < 768);
  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, []);

// Conditional rendering
{isMobile ? (
  <div className="space-y-3">
    {items.map(item => (
      <Card key={item.id} className="p-4">
        {/* Mobile card content */}
      </Card>
    ))}
  </div>
) : (
  <table className="w-full">
    {/* Desktop table */}
  </table>
)}
```

## Animation & Interactions

### Hover States
```css
/* Buttons */
hover:bg-blue-600   /* Primary button hover */
hover:bg-gray-200   /* Secondary button hover */

/* Table rows */
hover:bg-gray-50    /* Table row hover */

/* Interactive elements */
hover:text-blue-800 /* Link hover */
```

### Focus States
```css
/* Form inputs */
focus:ring-2 focus:ring-blue-500 focus:border-blue-500

/* Buttons */
focus:outline-none focus:ring-2 focus:ring-blue-500
```

### Transitions
```css
/* Standard transition */
transition-colors duration-200

/* Button transitions */
transition-all duration-200
```

## Accessibility

### Color Contrast
- Ensure text meets WCAG AA standards (4.5:1 ratio)
- Use color + text/icons for status indication
- Test with colorblind simulation

### Focus Management
- Visible focus indicators on all interactive elements
- Logical tab order
- Skip links for navigation

### Semantic HTML
- Use proper heading hierarchy (h1 → h2 → h3)
- Form labels associated with inputs
- ARIA labels for icon-only buttons

## Usage Guidelines

### DO
- ✅ Use established component patterns
- ✅ Follow responsive grid layouts
- ✅ Maintain consistent spacing (space-y-3, space-y-4)
- ✅ Use semantic HTML elements
- ✅ Test on mobile devices
- ✅ Include error states and validation
- ✅ Use icons from Lucide React consistently

### DON'T
- ❌ Create custom styling outside the design system
- ❌ Use arbitrary spacing values
- ❌ Mix different input styling patterns
- ❌ Skip error handling and validation states
- ❌ Ignore mobile responsive design
- ❌ Create inconsistent button variants

## Plugin-Specific Guidelines

### Form Plugins (Create/Edit)
- Use Card structure with Heading for sections
- Implement `space-y-4` between sections
- Include validation summary at top
- Use responsive grid for field layout
- Add unsaved changes protection

### List Plugins (Overview)
- Implement mobile-first responsive design
- Use search and sort controls
- Include empty states with helpful messaging
- Provide clear action buttons
- Use status badges consistently

### View Plugins (Detail)
- Use Card sections for information groups
- Include cross-plugin references where applicable
- Show metadata (created/updated dates)
- Provide clear action buttons for edit/delete

## Future Enhancements

This style guide will be updated as we:
- Add new component patterns
- Refine existing designs
- Introduce new plugin types
- Expand the design system

---

*Last Updated: July 19, 2025*  
*Version: 1.0 - Initial style guide based on contacts, notes, and estimates plugins*