# EletroLab - Simulador Interativo de Campos Eletricos

EletroLab e um laboratorio virtual de eletrostatica feito para uma apresentacao pratica de Fisica 3. Ele permite posicionar cargas puntiformes positivas, negativas e uma carga de prova em um canvas, visualizando em tempo real o campo eletrico, o potencial eletrico, linhas de campo, linhas equipotenciais e a forca sobre a carga de prova.

## Objetivo

O projeto ajuda a explorar qualitativa e quantitativamente os conceitos de Lei de Coulomb, campo eletrico, principio da superposicao, potencial eletrico e forca eletrica. A interface foi pensada para demonstracoes em sala e para testes interativos de configuracoes classicas, como dipolo, cargas iguais e quadrupolo.

## Tecnologias utilizadas

- HTML5
- CSS3
- JavaScript puro
- Canvas API
- Nenhum framework, backend, banco de dados ou etapa de compilacao

## Estrutura de arquivos

```text
eletrolab/
|-- index.html
|-- README.md
|-- css/
|   `-- style.css
|-- js/
|   |-- app.js
|   |-- physics.js
|   |-- renderer.js
|   `-- ui.js
`-- assets/
    `-- favicon.svg
```

## Como executar

Abra o arquivo `index.html` diretamente no navegador ou use uma extensao como Live Server. O projeto nao precisa de instalacao.

## Funcionalidades

- Adicao de cargas positivas, negativas e multiplas cargas de prova (`q0`, `q1`, `q2`...)
- Selecao, arraste, edicao numerica e exclusao de cargas
- Presets: dipolo eletrico, duas cargas positivas, duas negativas, quadrupolo e carga positiva central
- Vetores do campo eletrico com comprimento visual normalizado
- Linhas de campo por integracao numerica
- Mapa de potencial eletrico com normalizacao por `tanh`
- Linhas equipotenciais aproximadas por Marching Squares
- Painel de resultados com `E`, `Ex`, `Ey`, `V`, `F`, `Fx`, `Fy` e direcao da forca para a carga de prova selecionada
- Controles de densidade visual, transparencia e exibicao
- Modal com fundamentacao fisica
- Layout responsivo para desktop, tablet e celular

## Formulas implementadas

A constante eletrostatica utilizada e:

```javascript
K = 8.9875517923e9
```

As cargas sao exibidas em microcoulombs, mas convertidas internamente para coulombs:

```javascript
qCoulomb = qMicroCoulomb * 1e-6
```

O campo eletrico de uma carga puntiforme e calculado pela forma vetorial:

```text
E = kq/r^2
```

No codigo, a direcao radial e considerada pelas componentes:

```text
Ex = kq ux/r^2
Ey = kq uy/r^2
```

O potencial eletrico e:

```text
V = k soma(qi/ri)
```

A forca sobre a carga de prova e:

```text
F = q0 E
Fx = q0 Ex
Fy = q0 Ey
```

## Escala utilizada

O canvas trabalha em pixels. Para transformar distancia visual em distancia fisica, foi definida a escala:

```javascript
PIXELS_PER_METER = 100
```

Assim, uma distancia de `100 px` corresponde a `1 m`. Essa escala e uma simplificacao didatica para permitir que os valores aparecam de forma compreensivel na tela.

## Limitacoes da simulacao

- As cargas sao tratadas como cargas puntiformes.
- O modelo e bidimensional.
- Valores muito proximos das cargas sao limitados por uma distancia minima para impedir singularidades numericas.
- O comprimento visual dos vetores e normalizado; os calculos fisicos continuam usando os valores reais.
- O mapa de potencial e calculado em grade de menor resolucao para preservar desempenho.
- As linhas equipotenciais sao aproximadas por uma malha discreta.

## Experimentos sugeridos

1. Uma carga positiva: verifique vetores saindo radialmente e potencial positivo.
2. Uma carga negativa: verifique vetores entrando na carga e potencial negativo.
3. Dipolo eletrico: observe linhas saindo da carga positiva e chegando a negativa.
4. Duas cargas positivas: procure o ponto medio onde o campo resultante fica aproximadamente nulo.
5. Carga de prova: mova `q0` ou `q1`, compare campo e forca, e altere seu sinal para ver a inversao da forca.

## Possiveis melhorias futuras

- Exportar imagem do canvas.
- Permitir salvar e carregar configuracoes.
- Adicionar uma ferramenta de medicao de distancia.
- Mostrar graficos de campo ou potencial ao longo de uma linha.
- Adicionar opcao para a carga de prova tambem contribuir para o campo principal.
