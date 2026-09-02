
-- Enum for enrichment status
CREATE TYPE public.enrichment_status AS ENUM ('pending', 'success', 'error');

-- Dedicated table for enriched client data
CREATE TABLE public.client_enriched_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  raw_data jsonb,
  status enrichment_status NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Enable RLS
ALTER TABLE public.client_enriched_data ENABLE ROW LEVEL SECURITY;

-- RLS: users access only their own enriched data (via client ownership)
CREATE POLICY "Users can view own enriched data"
  ON public.client_enriched_data FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = client_enriched_data.client_id AND clients.user_id = auth.uid()));

CREATE POLICY "Users can insert own enriched data"
  ON public.client_enriched_data FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = client_enriched_data.client_id AND clients.user_id = auth.uid()));

CREATE POLICY "Users can update own enriched data"
  ON public.client_enriched_data FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = client_enriched_data.client_id AND clients.user_id = auth.uid()));

CREATE POLICY "Users can delete own enriched data"
  ON public.client_enriched_data FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = client_enriched_data.client_id AND clients.user_id = auth.uid()));

-- Service role policy for edge function access
CREATE POLICY "Service role full access"
  ON public.client_enriched_data FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_client_enriched_data_updated_at
  BEFORE UPDATE ON public.client_enriched_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
