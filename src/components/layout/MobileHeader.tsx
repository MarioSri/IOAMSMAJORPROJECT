import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import {
  Menu,
  Bell,
  User,
  LogOut,
  Settings,
  Search,
  AlertTriangle,
  LayoutDashboard,
  FileText,
  CheckSquare,
  Calendar,
  MessageSquare,
  Files,
  ArrowRightLeft,
  BarChart3
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { UniversalSearchDropdown } from '@/components/navigation/UniversalSearchDropdown';

export const MobileHeader: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  const mainNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: FileText, label: 'Track Documents', path: '/track-documents' },
    { icon: CheckSquare, label: 'Approval Center', path: '/approvals' },
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
    { icon: MessageSquare, label: 'Messages', path: '/messages' },
    { icon: Files, label: 'Document Management', path: '/documents' },
    { icon: AlertTriangle, label: 'Emergency Management', path: '/emergency' },
    { icon: ArrowRightLeft, label: 'Approval Chain with Bypass', path: '/approval-routing' },
    { icon: BarChart3, label: 'Analytics Dashboard', path: '/analytics' },
  ];

  const bottomMenuItems = [
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <header className="md:hidden sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-pt">
      <div className="flex h-16 items-center justify-between px-4 min-h-[max(64px,calc(64px+env(safe-area-inset-top,0px)))]">
        {/* Left side - Menu */}
        <div className="flex items-center">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-12 w-12 min-w-[48px] min-h-[48px] touch-manipulation">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] sm:w-80 overflow-y-auto hide-scrollbar flex flex-col pt-[max(1.5rem,env(safe-area-inset-top,1.5rem))] pb-[max(1.5rem,env(safe-area-inset-bottom,1.5rem))]">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <div className="flex items-center gap-3 py-2">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">{user.role}</p>
                    </div>
                  </div>
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Navigation menu for {user.name}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 flex flex-col gap-6 pb-6">
                {/* Main Navigation */}
                <div className="space-y-1">
                  <p className="px-4 text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    Menu
                  </p>
                  {mainNavItems.map((item) => (
                    <Button
                      key={item.path}
                      variant="ghost"
                      onClick={() => {
                        navigate(item.path);
                        setMenuOpen(false);
                      }}
                      className="w-full justify-start h-12 text-base font-normal"
                    >
                      <item.icon className="w-5 h-5 mr-3 text-muted-foreground" />
                      {item.label}
                    </Button>
                  ))}
                </div>

                {/* Account Settings */}
                <div className="space-y-1 pt-4 border-t">
                  <p className="px-4 text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    Account
                  </p>
                  {bottomMenuItems.map((item) => (
                    <Button
                      key={item.path}
                      variant="ghost"
                      onClick={() => {
                        navigate(item.path);
                        setMenuOpen(false);
                      }}
                      className="w-full justify-start h-12 text-base font-normal"
                    >
                      <item.icon className="w-5 h-5 mr-3 text-muted-foreground" />
                      {item.label}
                    </Button>
                  ))}
                </div>

                <div className="pt-6 mt-6 border-t pb-8">
                  <Button
                    variant="ghost"
                    onClick={handleLogout}
                    className="w-full justify-start h-14 text-base text-destructive hover:text-destructive min-h-[56px] touch-manipulation"
                  >
                    <LogOut className="w-5 h-5 mr-3" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Center - Logo/Title */}
        {!searchExpanded && (
          <div className="flex-1 text-center px-4">
            <h1 className="text-lg font-bold">IAOMS</h1>
            <p className="text-xs text-muted-foreground">HITAM</p>
          </div>
        )}

        {/* Right side - Actions */}
        <div className={cn("flex items-center gap-3", searchExpanded && "flex-1 justify-end")}>
          <UniversalSearchDropdown
            className="w-auto"
            onExpandChange={setSearchExpanded}
          />

          {!searchExpanded && (
            <div className="relative">
              <NotificationCenter />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};