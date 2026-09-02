
## Instalação

Clone o repositório:

```bash
git clone URL_DO_REPOSITORIO
```

Acesse a pasta do projeto:

```bash
cd NOME_DO_PROJETO
```

Instale as dependências:

```bash
npm install
```

## Configuração das Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto.

Utilize o arquivo `.env.example` como referência, caso esteja disponível:

```bash
cp .env.example .env
```

Configure as variáveis de ambiente necessárias no arquivo `.env`.

Exemplo:

```env
VITE_API_URL=
```

> **Importante:** Nunca compartilhe ou versione o arquivo `.env` caso ele contenha chaves de API, tokens ou outras informações sensíveis.

## Executando o Projeto

Para iniciar o ambiente de desenvolvimento:

```bash
npm run dev
```

Após iniciar, acesse no navegador o endereço exibido no terminal. Normalmente:

```text
http://localhost:5173
```
