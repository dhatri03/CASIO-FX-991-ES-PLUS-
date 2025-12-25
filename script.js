document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const displayExpr = document.getElementById('display-expression');
    const displayRes = document.getElementById('display-result');
    const shiftInd = document.getElementById('shift-ind');
    const alphaInd = document.getElementById('alpha-ind');
    const modeInd = document.getElementById('mode-ind');
    const angleInd = document.getElementById('angle-ind');
    const modeMenu = document.getElementById('mode-menu');
    const setupMenu = document.getElementById('setup-menu');

    // --- State Variables ---
    let expression = '';     // Visual string
    let internalExpr = '';   // MathJS string
    let currentResult = '0';
    let lastAns = '0';
    let mode = 'COMP';       // COMP, CMPLX, STAT, BASE-N, EQN, MATRIX, TABLE, VECTOR
    let angleMode = 'DEG';   // DEG, RAD, GRA
    let shift = false;
    let alpha = false;
    let hyp = false;

    // Memories
    const memory = {
        A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0
    };
    const matrices = {}; // stored as arrays
    const vectors = {};  // stored as arrays

    // --- MathJS Configuration ---
    // Ensure math exists
    if (typeof math === 'undefined') {
        console.error("MathJS not loaded.");
        displayRes.textContent = "Error: Lib Missing";
    }

    // --- Core Updates ---
    function updateDisplay() {
        displayExpr.textContent = expression;
        displayRes.textContent = currentResult;

        shiftInd.classList.toggle('active', shift);
        alphaInd.classList.toggle('active', alpha);
        modeInd.textContent = mode;
        angleInd.textContent = angleMode;
    }

    function resetCalculator() {
        expression = '';
        internalExpr = '';
        currentResult = '0';
        shift = false;
        alpha = false;
        hyp = false;
        modeMenu.classList.add('hidden');
        setupMenu.classList.add('hidden');
        hideAllWizards();
        updateDisplay();
    }

    function hideAllWizards() {
        document.querySelectorAll('.matrix-wizard').forEach(w => w.classList.add('hidden'));
    }

    // --- Button Handler ---
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Prevent default just in case
            // e.preventDefault(); 

            const val = btn.dataset.val;
            const func = btn.dataset.func;
            const key = btn.dataset.key; // Replay keys
            const modeVal = btn.dataset.mode; // Mode buttons
            const setupVal = btn.dataset.setup; // Setup buttons

            // 1. Wizards / Menus Interactions
            // (Handled by specific logic usually, but we check overarching first)

            // 2. Global Function Keys
            if (func) {
                handleFunctionKey(func);
                return;
            }

            // 3. Mode/Setup Selections
            if (modeVal) {
                switchMode(modeVal);
                return;
            }
            if (setupVal) {
                handleSetup(setupVal);
                return;
            }

            // 4. Wizard internal buttons (handled by specific listeners below, ignoring generic click?)
            // We need to distinguish keypad buttons from wizard buttons. 
            // Keypad buttons are inside .calculator-body usually.
            if (!btn.closest('.calculator-body') && !btn.closest('.replay-btn')) return;

            // 5. Standard Input
            if (val) handleInput(val);
            if (key) handleReplay(key);

            updateDisplay();
        });
    });

    function handleFunctionKey(func) {
        if (func === 'SHIFT') {
            shift = !shift;
            alpha = false;
        } else if (func === 'ALPHA') {
            alpha = !alpha;
            shift = false;
        } else if (func === 'MODE') {
            if (shift) {
                // SETUP
                setupMenu.classList.remove('hidden');
                modeMenu.classList.add('hidden');
                shift = false;
            } else {
                // MODE
                modeMenu.classList.remove('hidden');
                setupMenu.classList.add('hidden');
            }
        } else if (func === 'ON') {
            resetCalculator();
        }
    }

    function handleSetup(val) {
        if (val === 'deg') angleMode = 'DEG';
        if (val === 'rad') angleMode = 'RAD';
        if (val === 'gra') angleMode = 'GRA';
        // math/line IO ignored for now
        setupMenu.classList.add('hidden');
        updateDisplay();
    }

    function switchMode(newMode) {
        mode = newMode;
        modeMenu.classList.add('hidden');
        resetCalculator(); // Clear screen on mode switch

        // Mode Initialization
        if (mode === 'MATRIX') openMatrixWizard();
        if (mode === 'VECTOR') openVectorWizard();
        if (mode === 'EQN') openEqnWizard();
        if (mode === 'TABLE') openTableWizard();

        updateDisplay();
    }

    let isNewCalculation = false; // Flag for auto-clear

    function handleInput(val) {
        // --- Special Command Handling ---
        if (val === 'AC') {
            expression = '';
            internalExpr = '';
            currentResult = '0';
            isNewCalculation = false;
            return;
        }
        if (val === 'DEL') {
            expression = expression.toString().slice(0, -1);
            internalExpr = internalExpr.toString().slice(0, -1);
            return;
        }
        if (val === '=') {
            calculate();
            isNewCalculation = true; // Mark done
            return;
        }

        // --- Auto-Clear Logic ---
        // If typing a number after calculation, clear previous.
        // If typing operator, assume Ans.
        const isOperator = ['+', '-', '*', '/', '^', 'pwr', 'square', 'cube'].includes(val) || val === ')' || val === '(';
        if (isNewCalculation) {
            if (!isOperator && !shift && !alpha) {
                // Number or function start -> Clear
                expression = '';
                internalExpr = '';
            } else {
                // Operator -> Keep Ans logic (Ans + ...)
                // Usually calculator keeps Ans in memory but if we just type +, it means Ans+
                if (expression === '') {
                    expression = 'Ans';
                    internalExpr = lastAns || '0';
                }
            }
            isNewCalculation = false;
        }


        // --- Character Mapping ---
        let vChar = val; // Visual
        let iChar = val; // Internal

        // Numeric / Basic ops
        if (val === '*') { vChar = '×'; iChar = '*'; }
        if (val === '/') { vChar = '÷'; iChar = '/'; }

        // Shift Functions (Logic)
        if (shift) {
            if (val === 'sin') { vChar = 'sin⁻¹('; iChar = 'asin('; }
            else if (val === 'cos') { vChar = 'cos⁻¹('; iChar = 'acos('; }
            else if (val === 'tan') { vChar = 'tan⁻¹('; iChar = 'atan('; }
            else if (val === 'ln') { vChar = 'e^'; iChar = 'exp('; } // e^x
            else if (val === 'log') { vChar = '10^'; iChar = '10^'; } // 10^x
            else if (val === 'sqrt') { vChar = '³√('; iChar = 'cbrt('; } // cube root
            else if (val === 'square') { vChar = '³'; iChar = '^3'; } // cube
            else if (val === '*') { vChar = 'P'; iChar = 'permutations('; } // nPr
            else if (val === '/') { vChar = 'C'; iChar = 'combinations('; } // nCr
            else if (val === ')') { vChar = 'X'; iChar = 'X'; } // X variable shortcut
            else if (val === 'exp') { vChar = 'π'; iChar = 'pi'; }
            else if (val === 'ans') { vChar = '%'; iChar = '/100'; } // percent
            else if (val === 'sto') {
                // Recall? Usually Shift+RCL=STO, direct RCL=Recall. 
                // Button says STO directly. Shift+STO = ? 
                // Let's assume Shift+STO is nothing or specific setup.
            }
            else if (val === 'integral') {
                // Shift + Integral = d/dx
                // Format: d/dx(func, val) -> deriv(func, val)
                vChar = 'd/dx('; iChar = 'deriv(';
            }

            shift = false; // Consume shift
        }
        // Alpha Functions
        else if (alpha) {
            // Map keys to A,B,C...
            if (val === ')') { vChar = 'X'; iChar = 'X'; }
            if (val === 'sd') { vChar = 'Y'; iChar = 'Y'; }
            if (val === 'm+') { vChar = 'M'; iChar = 'M'; }
            if (val === '7') { vChar = 'A'; iChar = 'A'; }
            if (val === '8') { vChar = 'B'; iChar = 'B'; }
            if (val === '9') { vChar = 'C'; iChar = 'C'; }
            if (val === '4') { vChar = 'D'; iChar = 'D'; }
            if (val === '5') { vChar = 'E'; iChar = 'E'; }
            if (val === '6') { vChar = 'F'; iChar = 'F'; }

            alpha = false;
        }
        // Normal Functions
        else {
            if (val === 'sin') { vChar = 'sin('; iChar = 'sin('; }
            if (val === 'cos') { vChar = 'cos('; iChar = 'cos('; }
            if (val === 'tan') { vChar = 'tan('; iChar = 'tan('; }
            if (val === 'log') { vChar = 'log('; iChar = 'log10('; }
            if (val === 'ln') { vChar = 'ln('; iChar = 'log('; }
            if (val === 'sqrt') { vChar = '√('; iChar = 'sqrt('; }
            if (val === 'square') { vChar = '²'; iChar = '^2'; }
            if (val === 'cube') { vChar = '³'; iChar = '^3'; }
            if (val === 'recip') { vChar = '⁻¹'; iChar = '^(-1)'; }
            if (val === 'abs') { vChar = 'Abs('; iChar = 'abs('; }
            if (val === 'exp') { vChar = '×10'; iChar = '*10^'; }
            if (val === 'ans') { vChar = 'Ans'; iChar = lastAns ? lastAns : '0'; }
            if (val === 'sd') {
                // Toggle Decimal / Fraction
                // Heuristic: If contains '.', convert to Fraction. If Fraction, convert to decimal.
                if (!currentResult) return;

                try {
                    const strRes = currentResult.toString();
                    if (strRes.includes('/')) {
                        // Is Fraction -> Decimal
                        currentResult = math.evaluate(strRes).toString();
                    } else {
                        // Is Decimal -> Fraction
                        const f = math.fraction(strRes);
                        currentResult = f.n + '/' + f.d;
                    }
                    updateDisplay();
                } catch (e) { /* ignore */ }
                return;
            }
            if (val === 'pwr') { vChar = '^('; iChar = '^('; }
            if (val === 'integral') { vChar = '∫('; iChar = 'integrate('; }
        }

        // Special handling for nPr/nCr infix
        // If iChar is 'permutations(', we need to wrap the PREVIOUS number? 
        // MathJS `permutations(n, r)` is function style.
        // User types: 5 P 2. 
        // We can't easily rewrite previous input without full parser.
        // TRICK: Store as `permutations(` but when calculating, we might need to regex replace `(\d+)P(\d+)` -> `permutations($1,$2)`.
        // Let's change iChar to just 'P' or 'C' and handle in calculate step.
        if (iChar === 'permutations(') iChar = 'P';
        if (iChar === 'combinations(') iChar = 'C';

        expression += vChar;
        internalExpr += iChar;
    }

    function handleReplay(key) {
        // Just move cursor theory? Not implementing full cursor editing in this scope.
    }

    function calculate() {
        try {
            let expr = internalExpr;

            // 1. Handle Permutation/Combination Syntax
            // Regex: Number P Number -> permutations(n, r)
            // Updated to allow variables (Ans, A, B...)
            expr = expr.replace(/([a-zA-Z0-9_.]+)P([a-zA-Z0-9_.]+)/g, 'permutations($1, $2)');
            expr = expr.replace(/([a-zA-Z0-9_.]+)C([a-zA-Z0-9_.]+)/g, 'combinations($1, $2)');

            // 2. Handle Integration / Differentiation Syntax
            // Integrate: integrate(func, col, a, b) ?? No, we used `integrate(`
            // User types: ∫(sin(X), 0, 1) or simplified?
            // Casio syntax: ∫(f(x), a, b)
            // Implementation: We check for `integrate(expression, start, end)`
            // We need a helper to run numerical integration. 
            // We can replace `integrate(...)` calls with a custom evaluation.
            // But MathJS evaluate won't handle custom `integrate` function easily unless defined in scope.
            // Let's define `integrate` and `deriv` in the scope! function pointers.

            // 3. Handle Degree Mode
            const scope = {
                ...memory,
                Ans: parseFloat(lastAns) || 0,
                // Custom Calculus Functions in Scope
                integrate: (fStr, a, b) => numericalIntegration(fStr, a, b),
                deriv: (fStr, xVal) => numericalDerivative(fStr, xVal)
            };

            if (angleMode === 'DEG') {
                const deg = Math.PI / 180;
                scope.sin = x => math.sin(x * deg);
                scope.cos = x => math.cos(x * deg);
                scope.tan = x => math.tan(x * deg);
                scope.asin = x => math.asin(x) / deg;
                scope.acos = x => math.acos(x) / deg;
                scope.atan = x => math.atan(x) / deg;
            }

            // 4. Evaluate
            // Note: For integrate/deriv to work, the first arg must be a string or node, but standard mathjs might evaluate args first.
            // `integrate(sin(X), 0, 1)` -> `sin(X)` will try to evaluate.
            // We need to pass the function as a STRING or wrapped.
            // "Natural Display" implies implicit handling. 
            // If user typed `integrate(sin(X)...`, X is undefined usually.
            // We might need to PRE-PROCESS the string to quote the function part? 
            // `integrate("sin(X)", 0, 1)` is safer.
            // Regex replace: integrate(..., -> integrate("...",
            // Complex Regex is risky. 
            // Attempt: Let mathjs parse, but providing X in scope? No, X varies.

            // Simpler Hack: If contains integrate/deriv, use specific handling or user must type valid syntax?
            // "User: integrate(sin(X), 0, 1)"
            // If we define X=0 in scope, it evaluates sin(0). Not what we want.
            // We can Custom Parse? Or just ask user to enter string? 
            // Let's rely on Function Syntax `math.parse` -> look for function calls?
            // Let's TRY defining `X` as a symbol?

            // Allow X to be used in expression without evaluating yet?
            // Refined: We will quote the first argument if it looks like calculus.
            // Regex: `integrate\(([^,]+),` -> `integrate("$1",`
            expr = expr.replace(/integrate\(([^,]+),/g, 'integrate("$1",');
            expr = expr.replace(/deriv\(([^,]+),/g, 'deriv("$1",');

            let res = math.evaluate(expr, scope);

            // Format result
            if (typeof res === 'number') {
                if (Math.abs(res % 1) < 1e-9) res = Math.round(res);
                else res = parseFloat(res.toPrecision(10));
            }

            currentResult = res.toString();
            lastAns = currentResult;

        } catch (e) {
            console.error(e);
            currentResult = 'Syntax ERROR';
        }
        updateDisplay();
    }

    // --- Calculus Helpers ---
    function numericalIntegration(funcExpr, a, b) {
        // Simpson's Rule
        const N = 100;
        const h = (b - a) / N;
        const f = math.compile(funcExpr); // compiles the string func

        let sum = f.evaluate({ X: a }) + f.evaluate({ X: b });
        for (let i = 1; i < N; i++) {
            const val = f.evaluate({ X: a + i * h });
            sum += (i % 2 === 0 ? 2 : 4) * val;
        }
        return (h / 3) * sum;
    }

    function numericalDerivative(funcExpr, xVal) {
        // Central Difference: (f(x+h) - f(x-h)) / 2h
        const h = 1e-5;
        const f = math.compile(funcExpr);
        const fPlus = f.evaluate({ X: xVal + h });
        const fMinus = f.evaluate({ X: xVal - h });
        return (fPlus - fMinus) / (2 * h);
    }


    // --- Advanced Mode Logic ---

    // MATRIX MODE
    function openMatrixWizard() {
        showWizard('matrix-wizard');
        document.getElementById('step-mat-sel').classList.remove('hidden');
        document.getElementById('step-mat-dim').classList.add('hidden');
        document.getElementById('step-mat-inp').classList.add('hidden');
    }

    // Matrix Internal Constants
    let matState = { name: 'A', rows: 2, cols: 2 };

    // Matrix Wizard Listeners
    setupWizardListeners('matrix',
        (name) => { matState.name = name; }, // On Select Name
        (dim) => { // On Select Dim
            if (dim === 'custom') {
                // prompt
                matState.rows = parseInt(prompt("Rows:", 2)) || 2;
                matState.cols = parseInt(prompt("Cols:", 2)) || 2;
            } else {
                const [r, c] = dim.split('x');
                matState.rows = parseInt(r);
                matState.cols = parseInt(c);
            }
        },
        () => renderGrid('matrix-input-grid', matState.rows, matState.cols), // Render
        () => { // Save
            const data = readGrid('matrix-input-grid', matState.rows, matState.cols);
            memory['Mat' + matState.name] = math.matrix(data);
            currentResult = 'Mat' + matState.name + ' Saved';
            hideAllWizards();
            updateDisplay();
        }
    );


    // VECTOR MODE
    let vectState = { name: 'A', dim: 2 };
    function openVectorWizard() {
        showWizard('vector-wizard');
        document.getElementById('step-vect-sel').classList.remove('hidden');
        document.getElementById('step-vect-dim').classList.add('hidden');
        document.getElementById('step-vect-inp').classList.add('hidden');
    }

    setupWizardListeners('vector',
        (name) => { vectState.name = name; },
        (dim) => { vectState.dim = parseInt(dim); },
        () => renderGrid('vector-input-grid', 1, vectState.dim), // Vector is 1xN
        () => {
            const data = readGrid('vector-input-grid', 1, vectState.dim);
            memory['Vct' + vectState.name] = math.matrix(data[0]); // store as 1D array
            currentResult = 'Vct' + vectState.name + ' Saved';
            hideAllWizards();
            updateDisplay();
        }
    );

    // EQUATION MODE
    let eqnState = { type: 'quad' };
    function openEqnWizard() {
        showWizard('eqn-wizard');
        document.getElementById('step-eqn-type').classList.remove('hidden');
        document.getElementById('step-eqn-inp').classList.add('hidden');
        document.getElementById('step-eqn-res').classList.add('hidden');
    }

    // EQN Listeners
    const eqnTypeBtns = document.getElementById('step-eqn-type')?.querySelectorAll('button');
    if (eqnTypeBtns) eqnTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            eqnState.type = btn.dataset.type;
            renderEqnInputs();
            document.getElementById('step-eqn-type').classList.add('hidden');
            document.getElementById('step-eqn-inp').classList.remove('hidden');
        });
    });

    document.getElementById('btn-solve-eqn')?.addEventListener('click', () => {
        solveEqn();
        document.getElementById('step-eqn-inp').classList.add('hidden');
        document.getElementById('step-eqn-res').classList.remove('hidden');
    });

    document.getElementById('btn-eqn-back')?.addEventListener('click', () => {
        openEqnWizard();
    });

    function renderEqnInputs() {
        const grid = document.getElementById('eqn-input-grid');
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = '1fr 1fr';

        let vars = [];
        if (eqnState.type === '2var') vars = ['a1', 'b1', 'c1', 'a2', 'b2', 'c2'];
        if (eqnState.type === '3var') vars = ['a1', 'b1', 'c1', 'd1', 'a2', 'b2', 'c2', 'd2', 'a3', 'b3', 'c3', 'd3'];
        if (eqnState.type === 'quad') vars = ['a', 'b', 'c'];
        if (eqnState.type === 'cubic') vars = ['a', 'b', 'c', 'd'];

        vars.forEach(v => {
            const l = document.createElement('label'); l.textContent = v; l.style.color = '#ccc';
            const i = document.createElement('input'); i.dataset.id = v; i.type = 'number';
            grid.appendChild(l); grid.appendChild(i);
        });
    }

    function solveEqn() {
        const inputs = document.getElementById('eqn-input-grid').querySelectorAll('input');
        const v = {};
        inputs.forEach(i => v[i.dataset.id] = parseFloat(i.value) || 0);

        let out = '';
        if (eqnState.type === 'quad') {
            const { a, b, c } = v;
            const d = b * b - 4 * a * c;
            if (d >= 0) {
                out = `X1 = ${(-b + Math.sqrt(d)) / (2 * a)}\nX2 = ${(-b - Math.sqrt(d)) / (2 * a)}`;
            } else out = 'No Real Roots';
        } else if (eqnState.type === 'cubic') {
            out = "Solver N/A"; // Placeholder for complexity
        } else if (eqnState.type === '2var') {
            // a1x + b1y = c1 ...
            try {
                const solution = math.lusolve([[v.a1, v.b1], [v.a2, v.b2]], [v.c1, v.c2]);
                out = `X = ${solution[0][0]}\nY = ${solution[1][0]}`;
            } catch (e) { out = "Infinite/No Sol"; }
        }
        document.getElementById('eqn-res-disp').textContent = out;
    }


    // TABLE MODE
    function openTableWizard() {
        showWizard('table-wizard');
        document.getElementById('step-table-input').classList.remove('hidden');
        document.getElementById('step-table-res').classList.add('hidden');
    }

    document.getElementById('btn-gen-table')?.addEventListener('click', () => {
        const func = document.getElementById('table-func').value;
        const start = parseFloat(document.getElementById('table-start').value);
        const end = parseFloat(document.getElementById('table-end').value);
        const step = parseFloat(document.getElementById('table-step').value);

        const grid = document.getElementById('table-res-disp');
        grid.innerHTML = '<div style="font-weight:bold; border-bottom:1px solid #000;">X</div><div style="font-weight:bold; border-bottom:1px solid #000;">F(X)</div>';

        try {
            const f = math.compile(func);
            for (let x = start; x <= end; x += step) {
                const y = f.evaluate({ x: x, X: x });
                const dX = document.createElement('div'); dX.textContent = x;
                const dY = document.createElement('div'); dY.textContent = parseFloat(y.toPrecision(5));
                grid.appendChild(dX); grid.appendChild(dY);
            }
        } catch (e) { grid.textContent = "Error"; }

        document.getElementById('step-table-input').classList.add('hidden');
        document.getElementById('step-table-res').classList.remove('hidden');
    });

    document.getElementById('btn-table-back')?.addEventListener('click', () => {
        document.getElementById('step-table-res').classList.add('hidden');
        document.getElementById('step-table-input').classList.remove('hidden');
    });


    // --- Utils ---
    function showWizard(id) {
        hideAllWizards();
        document.getElementById(id).classList.remove('hidden');
    }

    function setupWizardListeners(prefix, onName, onDim, onRender, onSave) {
        // Step 1: Name Selection
        const selStep = document.getElementById(prefix === 'matrix' ? 'step-mat-sel' : 'step-vect-sel');
        if (selStep) selStep.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                onName(prefix === 'matrix' ? btn.dataset.mat : btn.dataset.vect);
                selStep.classList.add('hidden');
                document.getElementById(prefix === 'matrix' ? 'step-mat-dim' : 'step-vect-dim').classList.remove('hidden');
            });
        });

        // Step 2: Dim Selection
        const dimStep = document.getElementById(prefix === 'matrix' ? 'step-mat-dim' : 'step-vect-dim');
        if (dimStep) dimStep.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                onDim(btn.dataset.dim);
                dimStep.classList.add('hidden');
                onRender();
                document.getElementById(prefix === 'matrix' ? 'step-mat-inp' : 'step-vect-inp').classList.remove('hidden');
            });
        });

        // Step 3: Save
        const saveBtn = document.getElementById(prefix === 'matrix' ? 'btn-save-matrix' : 'btn-save-vector');
        if (saveBtn) saveBtn.addEventListener('click', onSave);
    }

    function renderGrid(id, r, c) {
        const grid = document.getElementById(id);
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = `repeat(${c}, 1fr)`;
        for (let i = 0; i < r * c; i++) {
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.value = '0';
            grid.appendChild(inp);
        }
    }

    function readGrid(id, r, c) {
        const inputs = document.getElementById(id).querySelectorAll('input');
        const data = [];
        for (let i = 0; i < r; i++) {
            const row = [];
            for (let j = 0; j < c; j++) {
                row.push(parseFloat(inputs[i * c + j].value) || 0);
            }
            data.push(row);
        }
        return data;
    }

});
