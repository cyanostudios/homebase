import React, { useState, useEffect } from 'react';
import { Building, User, CheckSquare, Calculator, StickyNote } from 'lucide-react';
import { Heading } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { useApp } from '@/core/api/AppContext';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
import { useEstimates } from '@/plugins/estimates/hooks/useEstimates';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';
import { useProducts } from '../hooks/useProducts';
import { Button } from '@/core/ui/Button';

interface ProductViewProps {
  item?: any;      // generic current item (preferred by panel renderer)
  contact?: any;   // fallback (kept for compatibility with template)
}

export const ProductView: React.FC<ProductViewProps> = ({ item, contact }) => {
  // Normalize current entity to "product" (TEMP: fields still match contact schema)
  const product = item ?? contact;
  if (!product) return null;

  // Cross-plugin helpers (kept from template; can be refactored later for real product relations)
  const { getNotesForContact, getEstimatesForContact, getTasksForContact, getTasksWithMentionsForContact } = useApp();
  const { openNoteForView } = useNotes();
  const { openEstimateForView } = useEstimates();
  const { openTaskForView } = useTasks();

  // Close this panel before opening another plugin
  const { closeProductPanel } = useProducts();

  // Cross-plugin state (kept for now)
  const [mentionedInNotes, setMentionedInNotes] = useState<any[]>([]);
  const [relatedEstimates, setRelatedEstimates] = useState<any[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [mentionedInTasks, setMentionedInTasks] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingEstimates, setLoadingEstimates] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingTaskMentions, setLoadingTaskMentions] = useState(false);

  // Load cross-plugin data (TEMP: uses contact-centric helpers with product.id)
  useEffect(() => {
    if (!product?.id) return;

    const loadNotes = async () => {
      setLoadingNotes(true);
      try {
        const notes = await getNotesForContact(product.id);
        setMentionedInNotes(notes);
      } catch (error) {
        console.error('Failed to load notes for product:', error);
        setMentionedInNotes([]);
      } finally {
        setLoadingNotes(false);
      }
    };

    const loadEstimates = async () => {
      setLoadingEstimates(true);
      try {
        const estimates = await getEstimatesForContact(product.id);
        setRelatedEstimates(estimates);
      } catch (error) {
        console.error('Failed to load estimates for product:', error);
        setRelatedEstimates([]);
      } finally {
        setLoadingEstimates(false);
      }
    };

    const loadTasks = async () => {
      setLoadingTasks(true);
      try {
        const tasks = await getTasksForContact(product.id);
        setAssignedTasks(tasks);
      } catch (error) {
        console.error('Failed to load tasks for product:', error);
        setAssignedTasks([]);
      } finally {
        setLoadingTasks(false);
      }
    };

    const loadTaskMentions = async () => {
      setLoadingTaskMentions(true);
      try {
        const tasks = await getTasksWithMentionsForContact(product.id);
        setMentionedInTasks(tasks);
      } catch (error) {
        console.error('Failed to load task mentions for product:', error);
        setMentionedInTasks([]);
      } finally {
        setLoadingTaskMentions(false);
      }
    };

    loadNotes();
    loadEstimates();
    loadTasks();
    loadTaskMentions();
  }, [product?.id, getNotesForContact, getEstimatesForContact, getTasksForContact, getTasksWithMentionsForContact]);

  return (
    <div className="space-y-4">
      {/* Product (TEMP: contact-style) Details */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">Product Information</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {product.email && (
            <div>
              <div className="text-xs text-gray-500">Email</div>
              <div className="text-sm text-gray-900">{product.email}</div>
            </div>
          )}
          {product.website && (
            <div>
              <div className="text-xs text-gray-500">Website</div>
              <a
                href={product.website.startsWith('http') ? product.website : `https://${product.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                {product.website}
              </a>
            </div>
          )}
          {product.phone && (
            <div>
              <div className="text-xs text-gray-500">Phone 1</div>
              <div className="text-sm text-gray-900">{product.phone}</div>
            </div>
          )}
          {product.phone2 && (
            <div>
              <div className="text-xs text-gray-500">Phone 2</div>
              <div className="text-sm text-gray-900">{product.phone2}</div>
            </div>
          )}
        </div>
      </Card>

      {/* Addresses */}
      {product.addresses && product.addresses.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Addresses</Heading>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {product.addresses.map((address: any, index: number) => (
              <div key={address.id || index}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sm font-medium text-gray-900">{address.type}</div>
                </div>
                <div className="ml-0 space-y-1">
                  {address.addressLine1 && <div className="text-sm text-gray-900">{address.addressLine1}</div>}
                  {address.addressLine2 && <div className="text-sm text-gray-900">{address.addressLine2}</div>}
                  <div className="text-sm text-gray-900">
                    {[address.postalCode, address.city].filter(Boolean).join(' ')}
                  </div>
                  {address.region && <div className="text-sm text-gray-900">{address.region}</div>}
                  <div className="text-sm text-gray-900">{address.country}</div>
                  {address.email && <div className="mt-2 text-xs text-gray-600">{address.email}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Contact Persons (TEMP: only when type is company) */}
      {product.contactType === 'company' && product.contactPersons && product.contactPersons.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Contact Persons</Heading>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {product.contactPersons.map((person: any, index: number) => (
              <div key={person.id || index}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sm font-medium text-gray-900">{person.name}</div>
                  {person.title && <span className="text-sm text-gray-500">• {person.title}</span>}
                </div>
                <div className="ml-0 space-y-1">
                  {person.email && <div className="text-sm text-gray-600">{person.email}</div>}
                  {person.phone && <div className="text-sm text-gray-600">{person.phone}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Business Settings */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">Business Settings</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500">Tax Rate</div>
            <div className="text-sm text-gray-900">{product.taxRate}%</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Payment Terms</div>
            <div className="text-sm text-gray-900">{product.paymentTerms} days</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Currency</div>
            <div className="text-sm text-gray-900">{product.currency}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">F-Tax</div>
            <div className="text-sm text-gray-900">{product.fTax === 'yes' ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </Card>

      {/* Notes */}
      {product.notes && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Notes</Heading>
          <div className="text-sm text-gray-900">{product.notes}</div>
        </Card>
      )}

      {/* Cross-plugin references - Assigned Tasks */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">Assigned Tasks</Heading>
        {loadingTasks ? (
          <div className="text-sm text-gray-500">Loading tasks...</div>
        ) : assignedTasks.length > 0 ? (
          <div className="space-y-2">
            {assignedTasks.map((task: any) => {
              const getStatusBadge = (status: string) => {
                const statusColors: Record<string, string> = {
                  'not started': 'bg-gray-100 text-gray-800',
                  'in progress': 'bg-blue-100 text-blue-800',
                  'Done': 'bg-green-100 text-green-800',
                  'Canceled': 'bg-red-100 text-red-800',
                };
                const colorClass = statusColors[status] || statusColors['not started'];
                return <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}>{status}</span>;
              };

              const getPriorityBadge = (priority: string) => {
                const priorityColors: Record<string, string> = {
                  'Low': 'bg-gray-100 text-gray-600',
                  'Medium': 'bg-yellow-100 text-yellow-700',
                  'High': 'bg-red-100 text-red-700',
                };
                const colorClass = priorityColors[priority] || priorityColors['Medium'];
                return <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}>{priority}</span>;
              };

              return (
                <div key={task.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <CheckSquare className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">{task.title}</span>
                      {task.dueDate && (
                        <div className="text-xs text-gray-600 mt-1">Due: {new Date(task.dueDate).toLocaleDateString()}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getPriorityBadge(task.priority)}
                      {getStatusBadge(task.status)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { closeProductPanel(); openTaskForView(task); }}
                    className="text-green-700 hover:text-green-800 ml-3 flex-shrink-0"
                  >
                    View Task
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-500">No tasks assigned to this product.</div>
        )}
      </Card>

      {/* Cross-plugin references - Mentioned in Tasks */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">Mentioned in Tasks</Heading>
        {loadingTaskMentions ? (
          <div className="text-sm text-gray-500">Loading tasks...</div>
        ) : mentionedInTasks.length > 0 ? (
          <div className="space-y-2">
            {mentionedInTasks.map((task: any) => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <CheckSquare className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900">{task.title}</span>
                    {task.dueDate && (<div className="text-xs text-gray-600 mt-1">Due: {new Date(task.dueDate).toLocaleDateString()}</div>)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { closeProductPanel(); openTaskForView(task); }}
                  className="text-purple-700 hover:text-purple-800 ml-3 flex-shrink-0"
                >
                  View Task
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">This product is not mentioned in any tasks.</div>
        )}
      </Card>

      {/* Cross-plugin references - Related Estimates */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">Related Estimates</Heading>
        {loadingEstimates ? (
          <div className="text-sm text-gray-500">Loading estimates...</div>
        ) : relatedEstimates.length > 0 ? (
          <div className="space-y-2">
            {relatedEstimates.map((estimate: any) => (
              <div key={estimate.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Calculator className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900">{estimate.estimateNumber}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-medium text-gray-900">
                      {estimate.total?.toFixed(2)} {estimate.currency}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { closeProductPanel(); openEstimateForView(estimate); }}
                  className="text-blue-700 hover:text-blue-800 ml-3 flex-shrink-0"
                >
                  View Estimate
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">No estimates found for this product.</div>
        )}
      </Card>

      {/* Cross-plugin references - Mentioned in Notes */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">Mentioned in Notes</Heading>
        {loadingNotes ? (
          <div className="text-sm text-gray-500">Loading notes...</div>
        ) : mentionedInNotes.length > 0 ? (
          <div className="space-y-2">
            {mentionedInNotes.map((note: any) => (
              <div key={note.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <StickyNote className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900">{note.title}</span>
                  </div>
                  <div className="text-xs text-gray-600 flex-shrink-0">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { closeProductPanel(); openNoteForView(note); }}
                  className="text-yellow-700 hover:text-yellow-800 ml-3 flex-shrink-0"
                >
                  View Note
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">This product is not mentioned in any notes.</div>
        )}
      </Card>

      {/* Metadata */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">Product Metadata</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500">System ID</div>
            <div className="text-sm font-mono text-gray-900">{product.id}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Created</div>
            <div className="text-sm text-gray-900">{new Date(product.createdAt).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last Updated</div>
            <div className="text-sm text-gray-900">{new Date(product.updatedAt).toLocaleDateString()}</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
