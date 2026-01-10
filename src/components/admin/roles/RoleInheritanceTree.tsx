import { RoleTreeNode } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

interface RoleInheritanceTreeProps {
  tree: RoleTreeNode[];
}

export function RoleInheritanceTree({ tree }: RoleInheritanceTreeProps) {
  if (tree.length === 0) return null;

  const getRoleTypeColor = (type: string) => {
    switch (type) {
      case 'owner': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'manager': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'supervisor': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cashier': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'waiter': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'kitchen': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-1">
      {tree.map((node, index) => (
        <div
          key={`${node.role_id}-${index}`}
          className="flex items-center gap-2 py-1.5"
          style={{ paddingLeft: `${node.depth * 24}px` }}
        >
          {node.depth > 0 && (
            <div className="flex items-center text-muted-foreground">
              <div className="w-4 h-px bg-border mr-1" />
              <ChevronRight className="h-3 w-3" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{node.role_name}</span>
            <Badge 
              variant="outline" 
              className={`text-xs ${getRoleTypeColor(node.role_type)}`}
            >
              {node.role_type}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
