import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { requireAnyRole, requirePermission } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layouts/public-layout/public-layout.component').then(m => m.PublicLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/public/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'categorias',
        loadComponent: () =>
          import('./features/public/categories/categories.component').then(m => m.CategoriesComponent),
      },
      {
        path: 'categoria/:slug',
        loadComponent: () =>
          import('./features/public/category-detail/category-detail.component').then(m => m.CategoryDetailComponent),
      },
      {
        path: 'buscar',
        loadComponent: () =>
          import('./features/public/catalog-search/catalog-search.component').then(m => m.CatalogSearchComponent),
      },
      {
        path: 'producto/:id',
        loadComponent: () =>
          import('./features/public/product-detail/product-detail.component').then(
            m => m.ProductDetailComponent,
          ),
      },
      {
        path: 'ubicacion',
        loadComponent: () =>
          import('./features/public/location/location.component').then(m => m.LocationComponent),
      },
      {
        path: 'politicas',
        loadComponent: () =>
          import('./features/public/policies/policies.component').then(m => m.PoliciesComponent),
      },
      {
        path: 'carrito',
        loadComponent: () =>
          import('./features/public/cart/cart.component').then(m => m.CartComponent),
      },
      {
        path: 'mis-cotizaciones',
        loadComponent: () =>
          import('./features/public/client-account/client-account.component').then(
            m => m.ClientAccountComponent,
          ),
      },
    ],
  },
  {
    path: 'admin-login',
    loadComponent: () =>
      import('./features/admin/admin-login/admin-login.component').then(m => m.AdminLoginComponent),
  },
  {
    path: 'cambiar-password',
    loadComponent: () =>
      import('./features/admin/change-password/change-password.component').then(m => m.ChangePasswordComponent),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./layouts/admin-layout/admin-layout').then(m => m.AdminLayout),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: '/admin/dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'seguridad',
        loadComponent: () =>
          import('./features/admin/security-admin/security-admin.component').then(
            m => m.SecurityAdminComponent,
          ),
      },
      {
        path: 'reportes',
        canActivate: [requireAnyRole(['administrador', 'gerente'])],
        loadComponent: () =>
          import('./features/admin/reports-dashboard/reports-dashboard.component').then(m => m.ReportsDashboardComponent),
      },
      {
        path: 'bitacora',
        canActivate: [requirePermission('view_bitacora')],
        loadComponent: () =>
          import('./features/admin/bitacora-admin/bitacora-admin.component').then(m => m.BitacoraAdminComponent),
      },
      {
        path: 'productos/crear',
        redirectTo: '/admin/productos',
        pathMatch: 'full',
      },
      {
        path: 'productos/editar/:id',
        canActivate: [requirePermission('manage_products')],
        loadComponent: () =>
          import('./features/admin/product-form/product-form.component').then(m => m.ProductFormComponent),
      },
      {
        path: 'productos',
        canActivate: [requirePermission('manage_products')],
        loadComponent: () =>
          import('./features/admin/products-admin/products-admin.component').then(m => m.ProductsAdminComponent),
      },
      {
        path: 'categorias/editar/:id',
        canActivate: [requirePermission('manage_categories')],
        loadComponent: () =>
          import('./features/admin/category-form/category-form.component').then(m => m.CategoryFormComponent),
      },
      {
        path: 'categorias/crear',
        canActivate: [requirePermission('manage_categories')],
        loadComponent: () =>
          import('./features/admin/category-form/category-form.component').then(m => m.CategoryFormComponent),
      },
      {
        path: 'categorias',
        canActivate: [requirePermission('manage_categories')],
        loadComponent: () =>
          import('./features/admin/categories-admin/categories-admin.component').then(m => m.CategoriesAdminComponent),
      },
      {
        path: 'destacados',
        canActivate: [requirePermission('manage_featured')],
        loadComponent: () =>
          import('./features/admin/featured-admin/featured-admin.component').then(m => m.FeaturedAdminComponent),
      },
      {
        path: 'cotizaciones',
        canActivate: [requirePermission('view_quotes')],
        loadComponent: () =>
          import('./features/admin/quotations-admin/quotations-admin.component').then(m => m.QuotationsAdminComponent),
      },
      {
        path: 'politicas',
        canActivate: [requirePermission('manage_policies')],
        loadComponent: () =>
          import('./features/admin/policies-admin/policies-admin').then(m => m.PoliciesAdminComponent),
      },
      {
        path: 'chatbot',
        canActivate: [requirePermission('manage_chatbot')],
        loadComponent: () =>
          import('./features/admin/chatbot-admin/chatbot-admin.component').then(m => m.ChatbotAdminComponent),
      },
      {
        path: 'usuarios/crear',
        canActivate: [requirePermission('manage_users')],
        loadComponent: () =>
          import('./features/admin/users-admin/users-admin.component').then(m => m.UsersAdminComponent),
      },
      {
        path: 'usuarios',
        canActivate: [requirePermission('manage_users')],
        loadComponent: () =>
          import('./features/admin/user-list/user-list.component').then(m => m.UserListComponent),
      },
      // Rutas futuras para otras secciones administrativas
      // {
      //   path: 'productos',
      //   loadComponent: () => import('./features/admin/productos/productos.component').then(m => m.ProductosComponent),
      // },
    ],
  },
  { path: '**', redirectTo: '/' },
];
