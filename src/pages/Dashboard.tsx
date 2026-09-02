import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useClients } from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
import { useExportHistory } from '@/hooks/useExportHistory';
import { 
  Users, 
  FolderOpen, 
  FileText, 
  History,
  Plus,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { PROJECT_STATUS_LABELS } from '@/types/database';

export default function Dashboard() {
  const { clients, isLoading: loadingClients } = useClients();
  const { projects, isLoading: loadingProjects } = useProjects();
  const { exports, isLoading: loadingExports } = useExportHistory();

  const isLoading = loadingClients || loadingProjects || loadingExports;

  const stats = [
    {
      title: 'Clientes',
      value: clients.length,
      icon: Users,
      href: '/clients',
      color: 'bg-blue-500',
    },
    {
      title: 'Projetos',
      value: projects.length,
      icon: FolderOpen,
      href: '/projects',
      color: 'bg-green-500',
    },
    {
      title: 'Documentos',
      value: projects.reduce((acc, p) => acc + (p.documents?.length || 0), 0),
      icon: FileText,
      href: '/projects',
      color: 'bg-orange-500',
    },
    {
      title: 'Exportações',
      value: exports.length,
      icon: History,
      href: '/exports',
      color: 'bg-purple-500',
    },
  ];

  const recentProjects = projects.slice(0, 5);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Visão geral do sistema de gestão SPED
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/clients/new">
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <Link key={stat.title} to={stat.href}>
                  <Card className="transition-colors hover:bg-accent">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </CardTitle>
                      <div className={`rounded-md p-2 ${stat.color}`}>
                        <stat.icon className="h-4 w-4 text-white" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stat.value}</div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Recent Projects */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Projetos Recentes</CardTitle>
                  <CardDescription>
                    Últimos projetos criados ou atualizados
                  </CardDescription>
                </div>
                <Button variant="outline" asChild>
                  <Link to="/projects">
                    Ver todos
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="font-medium">Nenhum projeto ainda</h3>
                    <p className="text-sm text-muted-foreground">
                      Crie seu primeiro cliente e projeto para começar
                    </p>
                    <Button asChild className="mt-4">
                      <Link to="/clients/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Criar Cliente
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentProjects.map((project) => (
                      <Link
                        key={project.id}
                        to={`/projects/${project.id}`}
                        className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">{project.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(project.client as { name: string })?.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                            {PROJECT_STATUS_LABELS[project.status]}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
