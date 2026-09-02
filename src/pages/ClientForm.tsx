import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useClients, useClient } from '@/hooks/useClients';
import { ClientFormData } from '@/types/database';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { formatCnpj, stripCnpj, formatPhone } from '@/lib/cnpj';
import { supabase } from '@/integrations/supabase/client';

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const { createClient, updateClient } = useClients();
  const { data: existingClient, isLoading: loadingClient } = useClient(id);

  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    cnpj: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [displayCnpj, setDisplayCnpj] = useState('');
  const [displayPhone, setDisplayPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (existingClient) {
      const cnpjVal = existingClient.cnpj || '';
      setFormData({
        name: existingClient.name,
        cnpj: cnpjVal,
        email: existingClient.email || '',
        phone: existingClient.phone || '',
        address: existingClient.address || '',
        notes: existingClient.notes || '',
      });
      setDisplayCnpj(formatCnpj(cnpjVal));
      setDisplayPhone(formatPhone(existingClient.phone || ''));
    }
  }, [existingClient]);

  const handleCnpjChange = (value: string) => {
    const formatted = formatCnpj(value);
    setDisplayCnpj(formatted);
    setFormData({ ...formData, cnpj: stripCnpj(formatted) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isEditing && id) {
        await updateClient.mutateAsync({ id, ...formData });
        navigate(`/clients/${id}`);
      } else {
        const newClient = await createClient.mutateAsync(formData);
        // Trigger enrichment asynchronously if CNPJ is provided
        if (formData.cnpj && formData.cnpj.length >= 14) {
          supabase.functions.invoke('enrich-client', {
            body: { client_id: newClient.id, cnpj: formData.cnpj },
          }).catch((err) => console.error('Enrichment trigger failed:', err));
        }
        navigate(`/clients/${newClient.id}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditing && loadingClient) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Atualize os dados do cliente' : 'Preencha os dados do novo cliente'}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Informações do Cliente</CardTitle>
              <CardDescription>
                Os campos marcados com * são obrigatórios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome do cliente"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input
                    id="cnpj"
                    value={displayCnpj}
                    onChange={(e) => handleCnpjChange(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@empresa.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={displayPhone}
                    onChange={(e) => {
                      const formatted = formatPhone(e.target.value);
                      setDisplayPhone(formatted);
                      setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') });
                    }}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Endereço completo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações sobre o cliente"
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  {isEditing ? 'Salvar' : 'Criar Cliente'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </AppLayout>
  );
}
