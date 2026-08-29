import { Component, OnInit, OnDestroy, HostListener, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { FollowUpAlertsService } from '../../../core/services/follow-up-alerts.service';

interface MenuItem {
  label: string;
  route: string;
  permission?: string;
  roles?: string[];
}

const ALL_MENU_ITEMS: MenuItem[] = [
  { label: 'Inicio', route: '/admin/dashboard' },
  { label: 'Seguridad', route: '/admin/seguridad' },
  { label: 'Productos', route: '/admin/productos', permission: 'manage_products' },
  { label: 'Categorías', route: '/admin/categorias', permission: 'manage_categories' },
  { label: 'Destacados', route: '/admin/destacados', permission: 'manage_featured' },
  { label: 'Cotizaciones', route: '/admin/cotizaciones', permission: 'view_quotes' },
  { label: 'Reportes', route: '/admin/reportes', roles: ['administrador', 'gerente'] },
  { label: 'Bitácora', route: '/admin/bitacora', permission: 'view_bitacora' },
  { label: 'Políticas', route: '/admin/politicas', permission: 'manage_policies' },
  { label: 'Chatbot', route: '/admin/chatbot', permission: 'manage_chatbot' },
  { label: 'Usuarios', route: '/admin/usuarios', permission: 'manage_users' },
];

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-sidebar.component.html',
  styleUrl: './admin-sidebar.component.scss',
})
export class AdminSidebarComponent implements OnInit, OnDestroy {
  private readonly followUpAlerts = inject(FollowUpAlertsService);
  private readonly auth = inject(AuthService);

  isMenuOpen = false;
  private lastScrollTop = 0;

  userName = computed(() => this.auth.currentUser()?.name ?? 'Usuario');
  pendingQuotesCount = this.followUpAlerts.pendingCount;
  menuItems = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return [];
    return ALL_MENU_ITEMS.filter((item) => {
      if (item.roles?.length && !item.roles.includes(user.role)) return false;
      if (item.permission) return this.auth.hasPermission(item.permission);
      return true;
    });
  });

  getMenuLabel(item: MenuItem): string {
    if (item.route === '/admin/cotizaciones' && this.auth.hasRole('vendedor')) {
      return 'Mis cotizaciones';
    }
    return item.label;
  }

  showQuotesBadge(item: MenuItem): boolean {
    return (
      item.route === '/admin/cotizaciones' &&
      this.pendingQuotesCount() > 0 &&
      !this.auth.hasRole('vendedor')
    );
  }

  ngOnInit(): void {
    this.checkScreenSize();
  }

  ngOnDestroy(): void {
    // Cleanup si es necesario
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    this.lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (!this.isMenuOpen) return;

    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    const scrollDifference = Math.abs(currentScroll - this.lastScrollTop);
    
    // Cerrar menú si se hace scroll más del 10% de la altura de la ventana
    const scrollThreshold = window.innerHeight * 0.1;
    
    if (scrollDifference > scrollThreshold) {
      this.closeMenu();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    // Cerrar menú automáticamente si la pantalla es grande
    if (window.innerWidth > 768 && this.isMenuOpen) {
      this.closeMenu();
    }
  }
}
