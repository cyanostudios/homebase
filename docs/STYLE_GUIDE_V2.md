# Homebase Style Guide v2

## Overview

This style guide defines the visual and interaction patterns for Homebase's plugin-based architecture with complete v7+ styling standardization. All components follow Contact component patterns to maintain consistency across the application.

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
green-50: #f0fdf4   /* Status button backgrounds */
green-100: #dcfce7  /* Success background */
green-500: #22c55e  /* Success icons */
green-600: #16a34a  /* Success text */
green-700: #15803d  /* Success button text */
green-800: #166534  /* Success emphasis */

/* Warning/Yellow */
yellow-50: #fefce8  /* Warning background */
yellow-100: #fef3c7 /* Warning background */
yellow-600: #ca8a04 /* Warning text */
yellow-700: #a16207 /* Warning emphasis */

/* Error/Red */
red-50: #fef2f2     /* Error/rejected button backgrounds */
red-200: #fecaca    /* Error border */
red-400: #f87171    /* Error icons */
red-500: #ef4444    /* Error borders */
red-600: #dc2626    /* Error text */
red-700: #b91c1c    /* Error emphasis */
red-800: #991b1b    /* Error on light backgrounds */
```

### Typography (v7+ Standardized)

#### Font Sizes
```css
text-xs: 12px       /* Labels, badges, meta info, table data */
text-sm: 14px       /* Body text, content, form data */
text-base: 16px     /* Form inputs, primary content */
text-lg: 18px       /* Subheadings (rare) */
text-xl: 20px       /* Section headings (rare) */
text-2xl: 24px      /* Page titles only */
```

#### Font Weights
```css
font-medium: 500    /* Table headers, emphasis */
font-semibold: 600  /* Section headings, important text */
font-bold: 700      /* Page titles only */
```

#### View Typography Hierarchy (v7+ Standard)
```css
/* Section headings in view components */
text-sm font-semibold text-gray-900

/* Labels in view components */
text-xs text-gray-500

/* Content in view components */
text-sm text-gray-900
```

### Spacing (Contact-Standard)

#### Component Spacing
```css
/* Card Structure */
Card padding="sm" className="shadow-none px-0"

/* Section Spacing */
space-y-4: 16px     /* Between sections */
mb-3: 12px          /* Section heading margin */

/* Grid Spacing */
space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3

/* Layout Padding */
p-4 sm:p-8          /* Page padding (mobile/desktop) */
```

## Components (v7+ Standardized)

### Card Structure (Contact Pattern)
```tsx
<Card padding="sm" className="shadow-none px-0">
  <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
    Section Title
  </Heading>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {/* Content */}
  </div>
</Card>
```

### Form Layout (Standardized)
```tsx
<div className="space-y-4">
  <form className="space-y-4">
    {/* Validation Summary */}
    {hasBlockingErrors && (
      <Card padding="sm" className="shadow-none px-0">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          {/* Error content */}
        </div>
      </Card>
    )}
    
    {/* Form Sections */}
    <Card padding="sm" className="shadow-none px-0">
      <Heading level={3} className="mb-3">Section Title</Heading>
      <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
        {/* Form fields */}
      </div>
    </Card>
  </form>
</div>
```

### View Layout (v7+ Pattern)
```tsx
<div className="space-y-4">
  <Card padding="sm" className="shadow-none px-0">
    <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
      Section Title
    </Heading>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <div className="text-xs text-gray-500">Label</div>
        <div className="text-sm text-gray-900">Content</div>
      </div>
    </div>
  </Card>

  <hr className="border-gray-100" />
  
  {/* Next section */}
</div>
```

### Typography Components
```tsx
// Page titles
<Heading level={1}>Page Title</Heading>

// Section titles in views (v7+ standard)
<Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
  Section Title
</Heading>

// Form section titles
<Heading level={3} className="mb-3">Section Title</Heading>

// Labels and content in views
<div className="text-xs text-gray-500">Label</div>
<div className="text-sm text-gray-900">Content</div>
```

### Responsive Tables (Contact Pattern)
```tsx
// Screen size detection (required in all list components)
const [isMobileView, setIsMobileView] = useState(false);

useEffect(() => {
  const checkScreenSize = () => {
    setIsMobileView(window.innerWidth < 768);
  };
  checkScreenSize();
  window.addEventListener('resize', checkScreenSize);
  return () => window.removeEventListener('resize', checkScreenSize);
}, []);

// Conditional rendering
<Card>
  {!isMobileView ? (
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              onClick={() => handleSort('field')}>
            <div className="flex items-center gap-1">
              Header
              <SortIcon field="field" />
            </div>
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {items.map((item, idx) => (
          <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm font-medium text-gray-900">{item.name}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <div className="divide-y divide-gray-200">
      {items.map((item) => (
        <div key={item.id} className="p-4">
          {/* Mobile card content */}
        </div>
      ))}
    </div>
  )}
</Card>
```

### Status Management (v7+ Pattern)
```tsx
// Status buttons with visual feedback
<div className="flex flex-wrap gap-2">
  <Button 
    variant={status === 'draft' ? 'secondary' : 'ghost'} 
    size="sm"
    className={status === 'draft' 
      ? 'bg-gray-100 text-gray-800 ring-2 ring-gray-300' 
      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
    }
    onClick={() => handleStatusChange('draft')}
  >
    Draft
  </Button>
  <Button 
    variant={status === 'sent' ? 'primary' : 'ghost'} 
    size="sm"
    className={status === 'sent' 
      ? 'bg-blue-500 text-white ring-2 ring-blue-300' 
      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
    }
    onClick={() => handleStatusChange('sent')}
  >
    Sent
  </Button>
  <Button 
    variant={status === 'accepted' ? 'primary' : 'ghost'} 
    size="sm"
    className={status === 'accepted' 
      ? 'bg-green-500 text-white ring-2 ring-green-300' 
      : 'bg-green-50 text-green-700 hover:bg-green-100'
    }
    onClick={() => handleStatusChange('accepted')}
  >
    Accepted
  </Button>
  <Button 
    variant={status === 'rejected' ? 'danger' : 'ghost'} 
    size="sm"
    className={status === 'rejected' 
      ? 'bg-red-500 text-white ring-2 ring-red-300' 
      : 'bg-red-50 text-red-700 hover:bg-red-100'
    }
    onClick={() => handleStatusChange('rejected')}
  >
    Rejected
  </Button>
</div>
```

### Cross-Plugin Mentions (v7+ Enhanced)
```tsx
// Notes list with mention column
<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  Mentions
</th>

// Desktop mention display
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

### Enhanced Panel Headers (v7+ Dynamic)
```tsx
// Dynamic panel titles based on plugin and mode
const getPanelTitle = () => {
  if (mode === 'view' && item) {
    if (plugin.name === 'contacts') {
      return `#${item.contactNumber} • ${item.companyName} • ${item.organizationNumber}`;
    } else if (plugin.name === 'estimates') {
      return `${item.estimateNumber} • ${item.contactName} • ${item.total} ${item.currency}`;
    }
  }
  return mode === 'edit' ? `Edit ${itemType}` : `Create ${itemType}`;
};

// Dynamic panel subtitles with rich content
const getPanelSubtitle = () => {
  if (mode === 'view' && item) {
    if (plugin.name === 'estimates') {
      return (
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-blue-600" />
          <StatusBadge status={item.status} />
          <span className="text-xs text-gray-600">• Valid to {validTo}</span>
        </div>
      );
    }
  }
  return `${mode === 'edit' ? 'Update' : 'Enter new'} ${itemType} information`;
};
```

## Form Patterns (v7+ Standardized)

### Input Fields
```tsx
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

### Global Form Functions (Required Pattern)
```tsx
// Required in all form components
useEffect(() => {
  window.submitContactsForm = handleSubmit; // PLURAL naming required
  window.cancelContactsForm = handleCancel; // PLURAL naming required
  
  return () => {
    delete window.submitContactsForm;
    delete window.cancelContactsForm;
  };
}, [handleSubmit, handleCancel]);
```

## Page Layout Patterns (v7+ Standard)

### Page Header
```tsx
<div className="p-4 sm:p-8">
  <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <Heading level={1}>Page Title</Heading>
      <Text variant="caption">Page description</Text>
    </div>
    <div className="flex sm:block">
      <Button
        onClick={() => openPanel(null)}
        variant="primary"
        icon={Plus}
      >
        Add Item
      </Button>
    </div>
  </div>
</div>
```

### Search Controls (Standardized)
```tsx
<div className="mb-4">
  <div className="relative">
    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
    <input
      type="text"
      placeholder="Search items..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
</div>
```

## Plugin-Specific Patterns

### Contacts Plugin (Reference Implementation)
- **Icons:** Building (company), User (private)
- **Colors:** Blue for company, Green for private
- **Mobile optimization:** Complete responsive design
- **Cross-plugin:** View notes, references from estimates

### Notes Plugin (v7+ Enhanced)
- **Icons:** StickyNote (yellow theme)
- **@Mentions:** Contact names in mentions column
- **Cross-plugin:** Navigation to contacts with full data
- **Mobile optimization:** Mentions display in mobile cards

### Estimates Plugin (v7+ Enhanced)
- **Icons:** Calculator (blue theme)
- **Status management:** Visual feedback with proper colors
- **Enhanced view:** Status buttons, no currency in line items
- **Cross-plugin:** Customer dropdown from contacts

## Performance Guidelines

### Responsive Design Requirements
```tsx
// Required in all list components
const [isMobileView, setIsMobileView] = useState(false);

useEffect(() => {
  const checkScreenSize = () => {
    setIsMobileView(window.innerWidth < 768);
  };
  checkScreenSize();
  window.addEventListener('resize', checkScreenSize);
  return () => window.removeEventListener('resize', checkScreenSize);
}, []);
```

### Modular Context Integration
```tsx
// Use plugin-specific hooks for plugin data
const { items, openPanel, saveItem } = useMyPlugin();

// Use AppContext only for cross-plugin data
const { contacts, getNotesForContact } = useApp();
```

## Validation & Error Handling

### Error Summary Pattern
```tsx
{hasBlockingErrors && (
  <Card padding="sm" className="shadow-none px-0">
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            Cannot save item
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>Please fix the following errors before saving:</p>
            <ul className="list-disc list-inside mt-1">
              {validationErrors
                .filter(error => !error.message.includes('Warning'))
                .map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  </Card>
)}
```

## Implementation Checklist

### For New Components
- ✅ Follow Contact component patterns exactly
- ✅ Implement mobile-first responsive design
- ✅ Use standardized typography (text-xs labels, text-sm content)
- ✅ Include proper error handling and validation
- ✅ Add cross-plugin navigation where relevant
- ✅ Use plugin-specific hooks for data access
- ✅ Implement proper loading and empty states

### For Forms
- ✅ Use Card structure with shadow-none px-0
- ✅ Implement global form functions with plural naming
- ✅ Add validation summary at top
- ✅ Use responsive grid layout
- ✅ Include unsaved changes protection

### For Lists
- ✅ Implement mobile/desktop conditional rendering
- ✅ Add sortable headers with icons
- ✅ Include search functionality
- ✅ Use alternating row colors
- ✅ Add proper empty states

### For Views
- ✅ Use reduced typography (text-sm, text-xs)
- ✅ Section headers with text-sm font-semibold text-gray-900
- ✅ Add dividers between sections
- ✅ Include cross-plugin references
- ✅ Add metadata sections

## Migration Guidelines

### Converting Existing Components
1. **Update typography** - Change to v7+ size standards
2. **Add responsive design** - Implement mobile/desktop patterns
3. **Standardize cards** - Use shadow-none px-0 pattern
4. **Add cross-plugin features** - Where applicable
5. **Test mobile experience** - Verify all functionality works

### Quality Assurance
- Test on mobile devices (< 768px width)
- Verify cross-plugin navigation works
- Check typography consistency
- Validate error handling
- Ensure loading states work properly

---

*Last Updated: July 21, 2025*  
*Version: 2.0 - Complete v7+ styling standardization with Contact patterns as reference*