require('dotenv').config();

const express = require('express');
const banco = require('./database');

const app = express();
app.use(express.json());

const PORTA = process.env.PORT || 3000;

// Regras de comissão
function calcularComissao(valorVenda, percentualBase, tipoCliente, percentualRegiao) {
    const bonusCliente = tipoCliente === 'PF' ? 2 : 3;
    const percentualTotal =
        Number(percentualBase) + bonusCliente + Number(percentualRegiao);

    return Number((Number(valorVenda) * percentualTotal / 100).toFixed(2));
}

// Testa se o banco está acessível
app.get('/teste-banco', async (req, res) => {
    try {
        await banco.query('SELECT 1');
        res.json({ mensagem: 'Conexão com o banco realizada com sucesso.' });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Não foi possível conectar ao banco.' });
    }
});

// CADASTRAR VENDEDOR
app.post('/vendedores', async (req, res) => {
    try {
        const { nome, meta_mensal, percentual_base } = req.body;

        if (!nome || meta_mensal == null || percentual_base == null) {
            return res.status(400).json({
                erro: 'Informe nome, meta_mensal e percentual_base.'
            });
        }

        if (Number(meta_mensal) < 0 || Number(percentual_base) < 0) {
            return res.status(400).json({
                erro: 'A meta e o percentual base não podem ser negativos.'
            });
        }

        const [resultado] = await banco.execute(
            `INSERT INTO vendedores (nome, meta_mensal, percentual_base, ativo)
             VALUES (?, ?, ?, 1)`,
            [nome.trim(), Number(meta_mensal), Number(percentual_base)]
        );

        res.status(201).json({
            mensagem: 'Vendedor cadastrado com sucesso.',
            id_vendedor: resultado.insertId
        });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao cadastrar vendedor.' });
    }
});

// LISTAR VENDEDORES
app.get('/vendedores', async (req, res) => {
    try {
        const [vendedores] = await banco.execute(
            `SELECT id_vendedor, nome, meta_mensal, percentual_base, ativo
             FROM vendedores
             ORDER BY id_vendedor`
        );

        res.json(vendedores);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao listar vendedores.' });
    }
});

// BUSCAR UM VENDEDOR
app.get('/vendedores/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ erro: 'ID do vendedor inválido.' });
        }

        const [vendedores] = await banco.execute(
            `SELECT id_vendedor, nome, meta_mensal, percentual_base, ativo
             FROM vendedores
             WHERE id_vendedor = ?`,
            [id]
        );

        if (vendedores.length === 0) {
            return res.status(404).json({ erro: 'Vendedor não encontrado.' });
        }

        res.json(vendedores[0]);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao buscar vendedor.' });
    }
});

// ATUALIZAR VENDEDOR
app.put('/vendedores/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { nome, meta_mensal, percentual_base } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ erro: 'ID do vendedor inválido.' });
        }

        if (!nome || meta_mensal == null || percentual_base == null) {
            return res.status(400).json({
                erro: 'Informe nome, meta_mensal e percentual_base.'
            });
        }

        if (Number(meta_mensal) < 0 || Number(percentual_base) < 0) {
            return res.status(400).json({
                erro: 'A meta e o percentual base não podem ser negativos.'
            });
        }

        const [resultado] = await banco.execute(
            `UPDATE vendedores
             SET nome = ?, meta_mensal = ?, percentual_base = ?
             WHERE id_vendedor = ?`,
            [nome.trim(), Number(meta_mensal), Number(percentual_base), id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ erro: 'Vendedor não encontrado.' });
        }

        res.json({ mensagem: 'Vendedor atualizado com sucesso.' });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao atualizar vendedor.' });
    }
});

// DESATIVAR VENDEDOR (mantém o histórico de vendas)
app.patch('/vendedores/:id/desativar', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ erro: 'ID do vendedor inválido.' });
        }

        const [resultado] = await banco.execute(
            `UPDATE vendedores SET ativo = 0 WHERE id_vendedor = ?`,
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ erro: 'Vendedor não encontrado.' });
        }

        res.json({ mensagem: 'Vendedor desativado com sucesso.' });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao desativar vendedor.' });
    }
});

// CADASTRAR VENDA
app.post('/vendas', async (req, res) => {
    try {
        const { id_venda, id_vendedor, id_regiao, data_venda, valor_venda, tipo_cliente } = req.body;

        if (
            id_venda == null || id_vendedor == null || id_regiao == null ||
            !data_venda || valor_venda == null || !tipo_cliente
        ) {
            return res.status(400).json({
                erro: 'Informe id_venda, id_vendedor, id_regiao, data_venda, valor_venda e tipo_cliente.'
            });
        }

        if (!Number.isInteger(Number(id_venda)) || Number(id_venda) <= 0) {
            return res.status(400).json({ erro: 'id_venda deve ser um número inteiro positivo.' });
        }

        if (!Number.isInteger(Number(id_vendedor)) || Number(id_vendedor) <= 0 ||
            !Number.isInteger(Number(id_regiao)) || Number(id_regiao) <= 0) {
            return res.status(400).json({ erro: 'ID do vendedor ou da região inválido.' });
        }

        if (!Number.isFinite(Number(valor_venda)) || Number(valor_venda) <= 0) {
            return res.status(400).json({ erro: 'O valor da venda deve ser maior que zero.' });
        }

        if (!['PF', 'PJ'].includes(tipo_cliente)) {
            return res.status(400).json({ erro: 'tipo_cliente deve ser PF ou PJ.' });
        }

        // Confere se o código da venda já foi utilizado.
        const [vendaExistente] = await banco.execute(
            'SELECT id_venda FROM vendas WHERE id_venda = ?',
            [Number(id_venda)]
        );

        if (vendaExistente.length > 0) {
            return res.status(409).json({ erro: 'Já existe uma venda com esse ID.' });
        }

        // Só vendedores ativos podem registrar novas vendas
        const [vendedores] = await banco.execute(
            `SELECT percentual_base
             FROM vendedores
             WHERE id_vendedor = ? AND ativo = 1`,
            [Number(id_vendedor)]
        );

        if (vendedores.length === 0) {
            return res.status(400).json({
                erro: 'Vendedor não encontrado ou está desativado.'
            });
        }

        const [regioes] = await banco.execute(
            `SELECT percentual_bonus
             FROM regioes
             WHERE id_regiao = ?`,
            [Number(id_regiao)]
        );

        if (regioes.length === 0) {
            return res.status(400).json({ erro: 'Região não encontrada.' });
        }

        const comissao = calcularComissao(
            valor_venda,
            vendedores[0].percentual_base,
            tipo_cliente,
            regioes[0].percentual_bonus
        );

        await banco.execute(
            `INSERT INTO vendas
             (id_venda, id_vendedor, id_regiao, data_venda, valor_venda, tipo_cliente, valor_comissao)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                Number(id_venda),
                Number(id_vendedor),
                Number(id_regiao),
                data_venda,
                Number(valor_venda),
                tipo_cliente,
                comissao
            ]
        );

        res.status(201).json({
            mensagem: 'Venda cadastrada com sucesso.',
            id_venda: Number(id_venda),
            valor_comissao: comissao
        });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao cadastrar venda.' });
    }
});

// LISTAR TODAS AS VENDAS
app.get('/vendas', async (req, res) => {
    try {
        const [vendas] = await banco.execute(
            `SELECT v.id_venda, v.data_venda, v.valor_venda, v.tipo_cliente,
                    v.valor_comissao, vend.id_vendedor, vend.nome AS vendedor,
                    r.id_regiao, r.nome_regiao
             FROM vendas v
             INNER JOIN vendedores vend ON vend.id_vendedor = v.id_vendedor
             INNER JOIN regioes r ON r.id_regiao = v.id_regiao
             ORDER BY v.data_venda DESC`
        );

        res.json(vendas);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao listar vendas.' });
    }
});

// CONSULTAR VENDAS DE UM VENDEDOR
app.get('/vendas/vendedor/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ erro: 'ID do vendedor inválido.' });
        }

        const [vendas] = await banco.execute(
            `SELECT v.id_venda, v.data_venda, v.valor_venda, v.tipo_cliente,
                    v.valor_comissao, vend.nome AS vendedor, r.nome_regiao
             FROM vendas v
             INNER JOIN vendedores vend ON vend.id_vendedor = v.id_vendedor
             INNER JOIN regioes r ON r.id_regiao = v.id_regiao
             WHERE v.id_vendedor = ?
             ORDER BY v.data_venda DESC`,
            [id]
        );

        res.json(vendas);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao consultar vendas do vendedor.' });
    }
});

// CONSULTAR VENDAS DE UMA REGIÃO
app.get('/vendas/regiao/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ erro: 'ID da região inválido.' });
        }

        const [vendas] = await banco.execute(
            `SELECT v.id_venda, v.data_venda, v.valor_venda, v.tipo_cliente,
                    v.valor_comissao, vend.nome AS vendedor, r.nome_regiao
             FROM vendas v
             INNER JOIN vendedores vend ON vend.id_vendedor = v.id_vendedor
             INNER JOIN regioes r ON r.id_regiao = v.id_regiao
             WHERE v.id_regiao = ?
             ORDER BY v.data_venda DESC`,
            [id]
        );

        res.json(vendas);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao consultar vendas da região.' });
    }
});

// EXCLUIR UMA VENDA
app.delete('/vendas/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ erro: 'ID da venda inválido.' });
        }

        const [resultado] = await banco.execute(
            'DELETE FROM vendas WHERE id_venda = ?',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ erro: 'Venda não encontrada.' });
        }

        res.json({ mensagem: 'Venda excluída com sucesso.' });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao excluir venda.' });
    }
});

// RELATÓRIO DE PERFORMANCE
// Exemplo: GET /relatorios/performance?inicio=2026-10-01&fim=2026-10-31
app.get('/relatorios/performance', async (req, res) => {
    try {
        const { inicio, fim } = req.query;

        if (!inicio || !fim) {
            return res.status(400).json({
                erro: 'Informe as datas inicio e fim no formato AAAA-MM-DD.'
            });
        }

        const formatoData = /^\d{4}-\d{2}-\d{2}$/;
        if (!formatoData.test(inicio) || !formatoData.test(fim) ||
            Number.isNaN(Date.parse(inicio)) || Number.isNaN(Date.parse(fim))) {
            return res.status(400).json({ erro: 'Formato de data inválido. Use AAAA-MM-DD.' });
        }

        if (inicio > fim) {
            return res.status(400).json({ erro: 'A data inicial não pode ser posterior à data final.' });
        }

        // Indicadores gerais: COUNT, SUM e AVG
        const [geral] = await banco.execute(
            `SELECT COUNT(*) AS quantidade_vendas,
                    COALESCE(SUM(valor_venda), 0) AS total_vendido,
                    COALESCE(AVG(valor_comissao), 0) AS media_comissao
             FROM vendas
             WHERE data_venda >= ? AND data_venda < DATE_ADD(?, INTERVAL 1 DAY)`,
            [inicio, fim]
        );

        // Total vendido e quantidade de vendas por região
        const [porRegiao] = await banco.execute(
            `SELECT r.id_regiao, r.nome_regiao,
                    COUNT(v.id_venda) AS quantidade_vendas,
                    COALESCE(SUM(v.valor_venda), 0) AS total_vendido,
                    COALESCE(AVG(v.valor_comissao), 0) AS media_comissao
             FROM regioes r
             LEFT JOIN vendas v
               ON v.id_regiao = r.id_regiao
              AND v.data_venda >= ? AND v.data_venda < DATE_ADD(?, INTERVAL 1 DAY)
             GROUP BY r.id_regiao, r.nome_regiao
             ORDER BY total_vendido DESC`,
            [inicio, fim]
        );

        // Total vendido por tipo de cliente (PF/PJ)
        const [porTipoCliente] = await banco.execute(
            `SELECT tipo_cliente, COUNT(*) AS quantidade_vendas,
                    COALESCE(SUM(valor_venda), 0) AS total_vendido
             FROM vendas
             WHERE data_venda >= ? AND data_venda < DATE_ADD(?, INTERVAL 1 DAY)
             GROUP BY tipo_cliente`,
            [inicio, fim]
        );

        // Vendedor com maior total vendido no período
        const [melhorVendedor] = await banco.execute(
            `SELECT vend.id_vendedor, vend.nome,
                    SUM(v.valor_venda) AS total_vendido,
                    COUNT(v.id_venda) AS quantidade_vendas
             FROM vendas v
             INNER JOIN vendedores vend ON vend.id_vendedor = v.id_vendedor
             WHERE v.data_venda >= ? AND v.data_venda < DATE_ADD(?, INTERVAL 1 DAY)
             GROUP BY vend.id_vendedor, vend.nome
             ORDER BY total_vendido DESC
             LIMIT 1`,
            [inicio, fim]
        );

        // Vendedor com maior soma de comissões no período
        const [maiorComissao] = await banco.execute(
            `SELECT vend.id_vendedor, vend.nome,
                    SUM(v.valor_comissao) AS total_comissao
             FROM vendas v
             INNER JOIN vendedores vend ON vend.id_vendedor = v.id_vendedor
             WHERE v.data_venda >= ? AND v.data_venda < DATE_ADD(?, INTERVAL 1 DAY)
             GROUP BY vend.id_vendedor, vend.nome
             ORDER BY total_comissao DESC
             LIMIT 1`,
            [inicio, fim]
        );

        // Compara as vendas de cada vendedor com a meta mensal cadastrada
        const [metas] = await banco.execute(
            `SELECT vend.id_vendedor, vend.nome, vend.meta_mensal,
                    COALESCE(SUM(v.valor_venda), 0) AS total_vendido,
                    CASE
                      WHEN COALESCE(SUM(v.valor_venda), 0) >= vend.meta_mensal THEN 1
                      ELSE 0
                    END AS meta_atingida
             FROM vendedores vend
             LEFT JOIN vendas v
               ON v.id_vendedor = vend.id_vendedor
              AND v.data_venda >= ? AND v.data_venda < DATE_ADD(?, INTERVAL 1 DAY)
             WHERE vend.ativo = 1
             GROUP BY vend.id_vendedor, vend.nome, vend.meta_mensal
             ORDER BY total_vendido DESC`,
            [inicio, fim]
        );

        res.json({
            periodo: { inicio, fim },
            indicadores_gerais: geral[0],
            vendas_por_regiao: porRegiao,
            vendas_por_tipo_cliente: porTipoCliente,
            melhor_vendedor: melhorVendedor[0] || null,
            maior_comissao_acumulada: maiorComissao[0] || null,
            metas_dos_vendedores: metas,
            quantidade_metas_atingidas: metas.filter(v => Number(v.meta_atingida) === 1).length
        });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao gerar relatório de performance.' });
    }
});

// Rota para endereços que não existem
app.use((req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada.' });
});

app.listen(PORTA, () => {
    console.log(`Servidor rodando em http://localhost:${PORTA}`);
});