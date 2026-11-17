import 'dotenv/config';
import { closeDatabaseConnection, db } from './index.js';
import { faculties, questions, subjects, type QuestionOption } from './schema.js';

type SubjectCode = 'ingles' | 'computacion' | 'matematicas' | 'fisica';

type SeedQuestionInput = {
    id: string;
    subjectCode: SubjectCode;
    topic: string;
    statementMd: string;
    options: QuestionOption[];
    correctKey: string;
    explanationMd?: string;
    procedureMd?: string;
    difficulty?: string;
    sourceRef: string;
};

const SEED_QUESTIONS: SeedQuestionInput[] = [
    // --- COMPUTACIÓN (COMPUTACION CUP 1-2023) ---
    {
        id: 'com-001',
        subjectCode: 'computacion',
        topic: 'software',
        statementMd: '¿Cuál de estos no es un software de aplicación?',
        options: [
            { key: 'A', text: 'Base de datos' },
            { key: 'B', text: 'Software empresarial' },
            { key: 'C', text: 'Compiladores' },
            { key: 'D', text: 'Software educativo' },
        ],
        correctKey: 'C',
        explanationMd: 'Los compiladores son software de desarrollo/programación, no de aplicación.',
        difficulty: 'easy',
        sourceRef: 'COMPUTACION CUP 1-2023 #2',
    },
    {
        id: 'com-002',
        subjectCode: 'computacion',
        topic: 'hardware',
        statementMd: 'Es un periférico de entrada:',
        options: [
            { key: 'A', text: 'La impresora' },
            { key: 'B', text: 'Disco duro' },
            { key: 'C', text: 'La pantalla' },
            { key: 'D', text: 'Scanner' },
        ],
        correctKey: 'D',
        explanationMd: 'El escáner (scanner) digitaliza documentos e introduce datos al computador.',
        difficulty: 'easy',
        sourceRef: 'COMPUTACION CUP 1-2023 #3',
    },
    {
        id: 'com-003',
        subjectCode: 'computacion',
        topic: 'arquitectura',
        statementMd:
            'La Unidad de Control, la Unidad Aritmética y Lógica y la Memoria Central (registros) son partes o componentes de otra unidad mayor llamada:',
        options: [
            { key: 'A', text: 'La memoria' },
            { key: 'B', text: 'Los periféricos' },
            { key: 'C', text: 'La tarjeta madre' },
            { key: 'D', text: 'La Unidad Central de Proceso' },
        ],
        correctKey: 'D',
        explanationMd: 'La CPU (Unidad Central de Proceso) integra la UC, la ALU y los registros.',
        difficulty: 'easy',
        sourceRef: 'COMPUTACION CUP 1-2023 #4',
    },
    {
        id: 'com-004',
        subjectCode: 'computacion',
        topic: 'arquitectura',
        statementMd: 'Conectan el procesador central con los demás componentes de un computador:',
        options: [
            { key: 'A', text: 'Los circuitos' },
            { key: 'B', text: 'La tarjeta madre' },
            { key: 'C', text: 'Bus' },
            { key: 'D', text: 'Reloj' },
        ],
        correctKey: 'C',
        explanationMd:
            'Los buses del sistema transportan datos, direcciones y señales de control entre la CPU y el resto de componentes.',
        difficulty: 'easy',
        sourceRef: 'COMPUTACION CUP 1-2023 #5',
    },
    {
        id: 'com-005',
        subjectCode: 'computacion',
        topic: 'software',
        statementMd: '¿Un Sistema Operativo es?',
        options: [
            { key: 'A', text: 'Software de Desarrollo' },
            { key: 'B', text: 'Software Utilitario' },
            { key: 'C', text: 'Software de Aplicación' },
            { key: 'D', text: 'Software de Base' },
        ],
        correctKey: 'D',
        explanationMd: 'El sistema operativo es el software de base o de sistema que gestiona el hardware.',
        difficulty: 'easy',
        sourceRef: 'COMPUTACION CUP 1-2023 #8',
    },
    {
        id: 'com-006',
        subjectCode: 'computacion',
        topic: 'seguridad',
        statementMd: 'Los virus, gusanos, troyanos y spywares son:',
        options: [
            {
                key: 'A',
                text: 'Tipos de programas informáticos que se ejecutan con el consentimiento del usuario o propietario de un ordenador',
            },
            {
                key: 'B',
                text: 'Tipos de programas informáticos que suelen utilizarse sin el consentimiento del usuario o propietario de un ordenador',
            },
            {
                key: 'C',
                text: 'Son programas informáticos que se utilizan para particionar el disco duro de un ordenador',
            },
            {
                key: 'D',
                text: 'Son programas que pueden infectar a los seres humanos a través del 5G',
            },
        ],
        correctKey: 'B',
        explanationMd:
            'El malware se ejecuta sin el consentimiento del propietario para dañar o extraer información.',
        difficulty: 'easy',
        sourceRef: 'COMPUTACION CUP 1-2023 #10',
    },
    {
        id: 'com-007',
        subjectCode: 'computacion',
        topic: 'memoria',
        statementMd: 'Una memoria de $1\\text{K}$ tiene:',
        options: [
            { key: 'A', text: '$1024$ direcciones' },
            { key: 'B', text: '$1000$ direcciones' },
            { key: 'C', text: '$100$ direcciones' },
            { key: 'D', text: '$256$ direcciones' },
        ],
        correctKey: 'A',
        explanationMd: 'En direccionamiento binario, $1\\text{K} = 2^{10} = 1024$ direcciones.',
        difficulty: 'medium',
        sourceRef: 'COMPUTACION CUP 1-2023 #29',
    },
    {
        id: 'com-008',
        subjectCode: 'computacion',
        topic: 'historia',
        statementMd: '¿Quién propuso la arquitectura clásica del computador con programa almacenado?',
        options: [
            { key: 'A', text: 'Joseph Marie Jacquard' },
            { key: 'B', text: 'Von Neumann' },
            { key: 'C', text: 'Herman Hollerith' },
            { key: 'D', text: 'Blaise Pascal' },
        ],
        correctKey: 'B',
        explanationMd: 'John von Neumann describió en 1945 la arquitectura de programa almacenado.',
        difficulty: 'medium',
        sourceRef: 'COMPUTACION CUP 1-2023 #43',
    },
    {
        id: 'com-009',
        subjectCode: 'computacion',
        topic: 'redes',
        statementMd: 'Es una topología de red donde cada nodo se conecta directamente con todos los otros nodos:',
        options: [
            { key: 'A', text: 'Estrella' },
            { key: 'B', text: 'Malla' },
            { key: 'C', text: 'Bus' },
            { key: 'D', text: 'Anillo' },
        ],
        correctKey: 'B',
        explanationMd:
            'En una topología en malla completa cada nodo tiene un enlace punto a punto con los demás.',
        difficulty: 'easy',
        sourceRef: 'COMPUTACION CUP 1-2023 #54',
    },
    {
        id: 'com-010',
        subjectCode: 'computacion',
        topic: 'sistemas-numericos',
        statementMd: 'Dado el número decimal $(45.25)_{10}$, su equivalente en binario es:',
        options: [
            { key: 'A', text: '$(101111.01)_2$' },
            { key: 'B', text: '$(101101.01)_2$' },
            { key: 'C', text: '$(101110.11)_2$' },
            { key: 'D', text: '$(110011.10)_2$' },
        ],
        correctKey: 'B',
        explanationMd: '$45_{10} = 32 + 8 + 4 + 1 = (101101)_2$ y $0.25_{10} = 2^{-2} = (0.01)_2$.',
        procedureMd:
            '1. Parte entera: $45 = 32 + 8 + 4 + 1 \\Rightarrow 101101_2$.\n2. Parte fraccionaria: $0.25 \\times 2 = 0.50 \\ (0)$; $0.50 \\times 2 = 1.00 \\ (1) \\Rightarrow .01_2$.\n3. Resultado: $(101101.01)_2$.',
        difficulty: 'medium',
        sourceRef: 'COMPUTACION CUP 1-2023 Sist.Num #3',
    },

    // --- MATEMÁTICAS (MATEMATICA CUP 1-2023) ---
    {
        id: 'mat-001',
        subjectCode: 'matematicas',
        topic: 'exponentes',
        statementMd:
            'Después de simplificar la expresión $$C = \\frac{2^{n+4} - 2 \\cdot 2^n}{2 \\cdot 2^{n+3}}$$ se obtiene:',
        options: [
            { key: 'A', text: '$2^{n+1} = \\frac{1}{8}$' },
            { key: 'B', text: '$\\frac{7}{8}$' },
            { key: 'C', text: '$-2^{n+1}$' },
            { key: 'D', text: '$1 - 2^n$' },
            { key: 'E', text: '$\\frac{7}{4}$' },
        ],
        correctKey: 'B',
        explanationMd: 'Factorizando $2^n$ en numerador y denominador se cancela la potencia variable.',
        procedureMd:
            '1. Extraer factor común $2^n$: $C = \\frac{2^n(2^4 - 2)}{2^n(2 \\cdot 2^3)}$.\n2. Evaluar: $C = \\frac{16 - 2}{16} = \\frac{14}{16} = \\frac{7}{8}$.',
        difficulty: 'medium',
        sourceRef: 'MATEMATICA CUP 1-2023 #2',
    },
    {
        id: 'mat-002',
        subjectCode: 'matematicas',
        topic: 'radicales',
        statementMd:
            'Después de simplificar la expresión $$C = \\sqrt[n]{\\frac{32}{2^{5+n}}}$$ se obtiene:',
        options: [
            { key: 'A', text: '$\\frac{1}{2}$' },
            { key: 'B', text: '$2$' },
            { key: 'C', text: '$4$' },
            { key: 'D', text: '$\\frac{1}{4}$' },
            { key: 'E', text: '$\\sqrt[n]{-n}$' },
        ],
        correctKey: 'A',
        explanationMd: 'Como $32 = 2^5$, el cociente dentro de la raíz se reduce a $2^{-n}$.',
        procedureMd:
            '1. Expresar $32 = 2^5$ y $2^{5+n} = 2^5 \\cdot 2^n$.\n2. Simplificar: $C = \\sqrt[n]{\\frac{2^5}{2^5 \\cdot 2^n}} = \\sqrt[n]{\\frac{1}{2^n}} = \\frac{1}{2}$.',
        difficulty: 'medium',
        sourceRef: 'MATEMATICA CUP 1-2023 #3',
    },
    {
        id: 'mat-003',
        subjectCode: 'matematicas',
        topic: 'radicales',
        statementMd:
            'El valor numérico de la expresión $$C = 4\\sqrt{50} - 8\\sqrt{\\frac{1}{2}}$$ es:',
        options: [
            { key: 'A', text: '$16\\sqrt{2}$' },
            { key: 'B', text: '$12\\sqrt{2}$' },
            { key: 'C', text: '$10\\sqrt{2}$' },
            { key: 'D', text: '$24\\sqrt{2}$' },
            { key: 'E', text: '$6\\sqrt{2}$' },
        ],
        correctKey: 'A',
        explanationMd: 'Ambos radicales se llevan a términos semejantes de $\\sqrt{2}$.',
        procedureMd:
            '1. $\\sqrt{50} = 5\\sqrt{2} \\Rightarrow 4\\sqrt{50} = 20\\sqrt{2}$.\n2. $8\\sqrt{\\frac{1}{2}} = 8 \\cdot \\frac{\\sqrt{2}}{2} = 4\\sqrt{2}$.\n3. Restar: $20\\sqrt{2} - 4\\sqrt{2} = 16\\sqrt{2}$.',
        difficulty: 'medium',
        sourceRef: 'MATEMATICA CUP 1-2023 #5',
    },
    {
        id: 'mat-004',
        subjectCode: 'matematicas',
        topic: 'radicales',
        statementMd:
            'El valor numérico de la expresión $$C = \\sqrt{5\\sqrt{2}+7} \\cdot \\sqrt{5\\sqrt{2}-7}$$ es:',
        options: [
            { key: 'A', text: '$\\sqrt{3}$' },
            { key: 'B', text: '$\\sqrt{-39}$' },
            { key: 'C', text: '$\\sqrt{43}$' },
            { key: 'D', text: '$1$' },
            { key: 'E', text: '$\\sqrt{57}$' },
        ],
        correctKey: 'D',
        explanationMd: 'Por diferencia de cuadrados bajo una sola raíz cuadrada.',
        procedureMd:
            '1. Unificar la raíz: $C = \\sqrt{(5\\sqrt{2})^2 - 7^2}$.\n2. Calcular: $C = \\sqrt{50 - 49} = \\sqrt{1} = 1$.',
        difficulty: 'medium',
        sourceRef: 'MATEMATICA CUP 1-2023 #7',
    },
    {
        id: 'mat-005',
        subjectCode: 'matematicas',
        topic: 'exponentes',
        statementMd:
            'Después de simplificar la expresión $$C = \\sqrt[n]{\\frac{5^{n+2} - 5^n}{24}}$$ el resultado es:',
        options: [
            { key: 'A', text: '$5$' },
            { key: 'B', text: '$\\sqrt[n]{\\frac{25}{24}}$' },
            { key: 'C', text: '$\\frac{1}{5}$' },
            { key: 'D', text: '$\\sqrt[n]{5^{n+1}}$' },
            { key: 'E', text: '$1$' },
        ],
        correctKey: 'A',
        explanationMd: 'Al factorizar $5^n$ en el numerador aparece $5^2 - 1 = 24$.',
        procedureMd:
            '1. Factorizar: $5^{n+2} - 5^n = 5^n(25 - 1) = 24 \\cdot 5^n$.\n2. Sustituir: $C = \\sqrt[n]{\\frac{24 \\cdot 5^n}{24}} = \\sqrt[n]{5^n} = 5$.',
        difficulty: 'medium',
        sourceRef: 'MATEMATICA CUP 1-2023 #8',
    },
    {
        id: 'mat-006',
        subjectCode: 'matematicas',
        topic: 'aritmetica',
        statementMd:
            'El valor numérico de la expresión $$C = \\left(\\frac{3}{2}\\right)^{-2} \\cdot \\frac{9}{16}$$ es:',
        options: [
            { key: 'A', text: '$\\frac{1}{2}$' },
            { key: 'B', text: '$4$' },
            { key: 'C', text: '$-\\frac{1}{2}$' },
            { key: 'D', text: '$\\frac{1}{4}$' },
            { key: 'E', text: '$3$' },
        ],
        correctKey: 'D',
        explanationMd: 'Invertir la fracción por el exponente negativo y simplificar.',
        procedureMd:
            '1. $\\left(\\frac{3}{2}\\right)^{-2} = \\left(\\frac{2}{3}\\right)^2 = \\frac{4}{9}$.\n2. Multiplicar: $\\frac{4}{9} \\cdot \\frac{9}{16} = \\frac{1}{4}$.',
        difficulty: 'easy',
        sourceRef: 'MATEMATICA CUP 1-2023 #11',
    },
    {
        id: 'mat-007',
        subjectCode: 'matematicas',
        topic: 'exponentes',
        statementMd: 'Después de simplificar la expresión $$E = \\frac{a^9 \\cdot a^{-2}}{a}$$ el resultado es:',
        options: [
            { key: 'A', text: '$a$' },
            { key: 'B', text: '$a^6$' },
            { key: 'C', text: '$a^9$' },
            { key: 'D', text: '$a^{-3}$' },
            { key: 'E', text: '$a^3$' },
        ],
        correctKey: 'B',
        explanationMd: 'Se suman los exponentes del numerador y se resta el del denominador.',
        procedureMd: '1. $E = a^{9 + (-2) - 1} = a^6$.',
        difficulty: 'easy',
        sourceRef: 'MATEMATICA CUP 1-2023 #12',
    },
    {
        id: 'mat-008',
        subjectCode: 'matematicas',
        topic: 'algebra',
        statementMd:
            '¿Cuál es el valor numérico de la expresión $a - 2(3b + c)$ cuando $a = 3$, $b = -1$ y $c = -4$?',
        options: [
            { key: 'A', text: '$-17$' },
            { key: 'B', text: '$11$' },
            { key: 'C', text: '$-11$' },
            { key: 'D', text: '$-7$' },
            { key: 'E', text: '$17$' },
        ],
        correctKey: 'E',
        explanationMd: 'Se reemplazan los valores respetando la jerarquía de signos.',
        procedureMd: '1. $3b + c = 3(-1) + (-4) = -7$.\n2. $a - 2(-7) = 3 + 14 = 17$.',
        difficulty: 'easy',
        sourceRef: 'MATEMATICA CUP 1-2023 #23',
    },
    {
        id: 'mat-009',
        subjectCode: 'matematicas',
        topic: 'factorizacion',
        statementMd: 'Al factorizar el trinomio $$x^2 + x - 30$$ se obtiene:',
        options: [
            { key: 'A', text: '$(x - 6)(x + 5)$' },
            { key: 'B', text: '$(x + 15)(x - 2)$' },
            { key: 'C', text: '$(x + 6)(x - 5)$' },
            { key: 'D', text: '$(x + 2)(x - 15)$' },
            { key: 'E', text: '$(x + 3)(x - 10)$' },
        ],
        correctKey: 'C',
        explanationMd: 'Dos números que multiplicados den $-30$ y sumados den $+1$ son $+6$ y $-5$.',
        procedureMd:
            '1. Buscar $p, q$ tales que $p \\cdot q = -30$ y $p + q = 1$.\n2. $6 \\cdot (-5) = -30$ y $6 + (-5) = 1 \\Rightarrow (x + 6)(x - 5)$.',
        difficulty: 'easy',
        sourceRef: 'MATEMATICA CUP 1-2023 #48',
    },
    {
        id: 'mat-010',
        subjectCode: 'matematicas',
        topic: 'ecuaciones',
        statementMd: 'Al resolver la ecuación $$3(2x - 1) - 2(5 - x) = 3$$ se obtiene:',
        options: [
            { key: 'A', text: '$2$' },
            { key: 'B', text: '$\\frac{1}{3}$' },
            { key: 'C', text: '$\\frac{1}{2}$' },
            { key: 'D', text: '$-\\frac{1}{2}$' },
            { key: 'E', text: '$-2$' },
        ],
        correctKey: 'A',
        explanationMd: 'Ecuación lineal de primer grado en $x$.',
        procedureMd:
            '1. Expandir: $6x - 3 - 10 + 2x = 3$.\n2. Agrupar: $8x - 13 = 3 \\Rightarrow 8x = 16 \\Rightarrow x = 2$.',
        difficulty: 'easy',
        sourceRef: 'MATEMATICA CUP 1-2023 #81',
    },

    // --- FÍSICA (FISICA CUP 1-2023) ---
    {
        id: 'fis-001',
        subjectCode: 'fisica',
        topic: 'cinematica',
        statementMd:
            'Un móvil recorre $680\\text{ m}$ en un tiempo de $2\\text{ min}$ y $50\\text{ s}$. La rapidez del móvil es:',
        options: [
            { key: 'A', text: '$5\\text{ m/s}$' },
            { key: 'B', text: '$4\\text{ m/s}$' },
            { key: 'C', text: '$2\\text{ m/s}$' },
            { key: 'D', text: '$8\\text{ m/s}$' },
            { key: 'E', text: 'Ninguna' },
        ],
        correctKey: 'B',
        explanationMd: 'Se convierte el tiempo total a segundos y se divide la distancia entre el tiempo.',
        procedureMd:
            '1. $t = 2 \\times 60\\text{ s} + 50\\text{ s} = 170\\text{ s}$.\n2. $v = \\frac{d}{t} = \\frac{680\\text{ m}}{170\\text{ s}} = 4\\text{ m/s}$.',
        difficulty: 'easy',
        sourceRef: 'FISICA CUP 1-2023 #1',
    },
    {
        id: 'fis-002',
        subjectCode: 'fisica',
        topic: 'cinematica',
        statementMd:
            'Una partícula se desplaza con una velocidad constante $\\vec{V} = (3\\hat{i} - 4\\hat{j})\\text{ m/s}$. Su distancia recorrida luego de $2\\text{ s}$ es:',
        options: [
            { key: 'A', text: '$7\\text{ m}$' },
            { key: 'B', text: '$8\\text{ m}$' },
            { key: 'C', text: '$10\\text{ m}$' },
            { key: 'D', text: '$5\\text{ m}$' },
            { key: 'E', text: 'Ninguna' },
        ],
        correctKey: 'C',
        explanationMd: 'La rapidez es el módulo del vector velocidad $|\\vec{V}| = 5\\text{ m/s}$.',
        procedureMd:
            '1. $|\\vec{V}| = \\sqrt{3^2 + (-4)^2} = \\sqrt{9 + 16} = 5\\text{ m/s}$.\n2. $d = |\\vec{V}| \\cdot t = 5\\text{ m/s} \\times 2\\text{ s} = 10\\text{ m}$.',
        difficulty: 'medium',
        sourceRef: 'FISICA CUP 1-2023 #8',
    },
    {
        id: 'fis-003',
        subjectCode: 'fisica',
        topic: 'cinematica',
        statementMd:
            'Dos móviles están separados inicialmente a $700\\text{ m}$ y viajan con velocidades de $10\\text{ m/s}$ y $25\\text{ m/s}$ respectivamente en sentidos contrarios. El tiempo de encuentro es de:',
        options: [
            { key: 'A', text: '$16\\text{ s}$' },
            { key: 'B', text: '$25\\text{ s}$' },
            { key: 'C', text: '$20\\text{ s}$' },
            { key: 'D', text: '$30\\text{ s}$' },
            { key: 'E', text: 'Ninguna' },
        ],
        correctKey: 'C',
        explanationMd: 'En sentidos opuestos las rapideces se suman para hallar el tiempo de encuentro.',
        procedureMd:
            '1. $t_e = \\frac{d}{v_1 + v_2} = \\frac{700\\text{ m}}{10\\text{ m/s} + 25\\text{ m/s}} = \\frac{700}{35}\\text{ s} = 20\\text{ s}$.',
        difficulty: 'easy',
        sourceRef: 'FISICA CUP 1-2023 #10',
    },
    {
        id: 'fis-004',
        subjectCode: 'fisica',
        topic: 'cinematica',
        statementMd:
            'Un móvil parte del reposo hasta alcanzar una velocidad de $50\\text{ m/s}$ en un tiempo de $10\\text{ s}$. La distancia que recorre el móvil es de:',
        options: [
            { key: 'A', text: '$250\\text{ m}$' },
            { key: 'B', text: '$300\\text{ m}$' },
            { key: 'C', text: '$200\\text{ m}$' },
            { key: 'D', text: '$350\\text{ m}$' },
            { key: 'E', text: 'Ninguna' },
        ],
        correctKey: 'A',
        explanationMd: 'En MRUV partiendo del reposo, $d = \\frac{v_f}{2} \\cdot t$.',
        procedureMd:
            '1. $d = \\left(\\frac{v_0 + v_f}{2}\\right) t = \\left(\\frac{0 + 50}{2}\\right) \\times 10 = 250\\text{ m}$.',
        difficulty: 'easy',
        sourceRef: 'FISICA CUP 1-2023 #11',
    },
    {
        id: 'fis-005',
        subjectCode: 'fisica',
        topic: 'caida-libre',
        statementMd:
            'Se deja caer una piedra desde la terraza de un edificio cuya altura es de $180\\text{ m}$. La velocidad justo antes de llegar al suelo es ($g = 10\\text{ m/s}^2$):',
        options: [
            { key: 'A', text: '$60\\text{ m/s}$' },
            { key: 'B', text: '$80\\text{ m/s}$' },
            { key: 'C', text: '$50\\text{ m/s}$' },
            { key: 'D', text: '$20\\text{ m/s}$' },
            { key: 'E', text: 'Ninguna' },
        ],
        correctKey: 'A',
        explanationMd: 'Por caída libre desde el reposo, $v = \\sqrt{2gh}$.',
        procedureMd:
            '1. $v = \\sqrt{2 \\cdot g \\cdot h} = \\sqrt{2 \\cdot 10 \\cdot 180} = \\sqrt{3600} = 60\\text{ m/s}$.',
        difficulty: 'easy',
        sourceRef: 'FISICA CUP 1-2023 #17',
    },
    {
        id: 'fis-006',
        subjectCode: 'fisica',
        topic: 'caida-libre',
        statementMd:
            'Se dispara un proyectil en forma vertical hacia arriba con una velocidad de $50\\text{ m/s}$. La altura a los $4\\text{ s}$ es de ($g = 10\\text{ m/s}^2$):',
        options: [
            { key: 'A', text: '$60\\text{ m}$' },
            { key: 'B', text: '$80\\text{ m}$' },
            { key: 'C', text: '$120\\text{ m}$' },
            { key: 'D', text: '$121\\text{ m}$' },
            { key: 'E', text: 'Ninguna' },
        ],
        correctKey: 'C',
        explanationMd: 'En tiro vertical hacia arriba, $h = v_0 t - \\frac{1}{2}gt^2$.',
        procedureMd: '1. $h = 50(4) - \\frac{1}{2}(10)(4^2) = 200 - 80 = 120\\text{ m}$.',
        difficulty: 'medium',
        sourceRef: 'FISICA CUP 1-2023 #21',
    },
    {
        id: 'fis-007',
        subjectCode: 'fisica',
        topic: 'trabajo-energia',
        statementMd:
            'Un automóvil de masa $5\\text{ kg}$ que se encuentra a una altura de $3\\text{ m}$ se mueve a una velocidad de $2\\text{ m/s}$. Su energía cinética es de:',
        options: [
            { key: 'A', text: '$20\\text{ J}$' },
            { key: 'B', text: '$10\\text{ J}$' },
            { key: 'C', text: '$150\\text{ J}$' },
            { key: 'D', text: '$15\\text{ J}$' },
            { key: 'E', text: 'Ninguno' },
        ],
        correctKey: 'B',
        explanationMd:
            'La energía cinética depende únicamente de la masa y la velocidad: $E_c = \\frac{1}{2}mv^2$.',
        procedureMd:
            '1. $E_c = \\frac{1}{2} m v^2 = \\frac{1}{2} (5\\text{ kg})(2\\text{ m/s})^2 = 10\\text{ J}$.',
        difficulty: 'easy',
        sourceRef: 'FISICA CUP 1-2023 #27',
    },
    {
        id: 'fis-008',
        subjectCode: 'fisica',
        topic: 'dinamica',
        statementMd:
            'Un móvil de masa $3\\text{ kg}$ se desplaza sobre un plano liso con una fuerza de $15\\text{ N}$ y se aplica una fuerza contraria al movimiento de $6\\text{ N}$. La aceleración del movimiento es:',
        options: [
            { key: 'A', text: '$1\\text{ m/s}^2$' },
            { key: 'B', text: '$3\\text{ m/s}^2$' },
            { key: 'C', text: '$2\\text{ m/s}^2$' },
            { key: 'D', text: '$4\\text{ m/s}^2$' },
            { key: 'E', text: 'Ninguna' },
        ],
        correctKey: 'B',
        explanationMd: 'Por la segunda ley de Newton, $\\sum F = m \\cdot a$.',
        procedureMd:
            '1. $F_R = 15\\text{ N} - 6\\text{ N} = 9\\text{ N}$.\n2. $a = \\frac{F_R}{m} = \\frac{9\\text{ N}}{3\\text{ kg}} = 3\\text{ m/s}^2$.',
        difficulty: 'easy',
        sourceRef: 'FISICA CUP 1-2023 #31',
    },
    {
        id: 'fis-009',
        subjectCode: 'fisica',
        topic: 'fluidos',
        statementMd:
            'En un émbolo circular con área de $2\\text{ m}^2$ se aplica una fuerza de $1000\\text{ N}$. ¿Cuál es el valor de la presión ejercida sobre el émbolo?',
        options: [
            { key: 'A', text: '$500\\text{ N/m}^2$' },
            { key: 'B', text: '$2000\\text{ N/m}^2$' },
            { key: 'C', text: '$250\\text{ N/m}^2$' },
            { key: 'D', text: '$1000\\text{ N/m}^2$' },
            { key: 'E', text: '$100\\text{ N/m}^2$' },
        ],
        correctKey: 'A',
        explanationMd: 'La presión se define como fuerza por unidad de área ($P = F/A$).',
        procedureMd: '1. $P = \\frac{F}{A} = \\frac{1000\\text{ N}}{2\\text{ m}^2} = 500\\text{ N/m}^2$.',
        difficulty: 'easy',
        sourceRef: 'FISICA CUP 1-2023 #38',
    },
    {
        id: 'fis-010',
        subjectCode: 'fisica',
        topic: 'fluidos',
        statementMd:
            'El enunciado «La presión aplicada a un fluido encerrado se transmite sin disminución a todas las partes del fluido y las paredes del recipiente» corresponde a:',
        options: [
            { key: 'A', text: 'Principio de Arquímedes' },
            { key: 'B', text: 'Ley de conservación de la energía' },
            { key: 'C', text: 'Principio de Pascal' },
            { key: 'D', text: 'Principio de Torricelli' },
            { key: 'E', text: 'Ecuación de continuidad' },
        ],
        correctKey: 'C',
        explanationMd:
            'Es la definición clásica del Principio de Pascal para fluidos incompresibles confinados.',
        difficulty: 'easy',
        sourceRef: 'FISICA CUP 1-2023 #42',
    },

    // --- INGLÉS (INGLES CUP 1-2023) ---
    {
        id: 'ing-001',
        subjectCode: 'ingles',
        topic: 'present-continuous',
        statementMd: 'Which is the best answer: *Where is Mary? She ……… over there.*',
        options: [
            { key: 'A', text: 'is stand' },
            { key: 'B', text: 'is standing' },
            { key: 'C', text: 'stand' },
            { key: 'D', text: 'Stands' },
        ],
        correctKey: 'B',
        explanationMd: 'Present continuous (*is + verb-ing*) describes an action happening right now.',
        difficulty: 'easy',
        sourceRef: 'INGLES CUP 1-2023 #2',
    },
    {
        id: 'ing-002',
        subjectCode: 'ingles',
        topic: 'past-continuous',
        statementMd:
            'Which of the following is in the past continuous: *They ……… TV in the dining room last night.*',
        options: [
            { key: 'A', text: 'Are watched' },
            { key: 'B', text: 'were watching' },
            { key: 'C', text: 'did watched' },
            { key: 'D', text: 'does watched' },
        ],
        correctKey: 'B',
        explanationMd: 'For plural pronoun *They*, past continuous uses *were + verb-ing*.',
        difficulty: 'easy',
        sourceRef: 'INGLES CUP 1-2023 #5',
    },
    {
        id: 'ing-003',
        subjectCode: 'ingles',
        topic: 'present-continuous',
        statementMd: 'Complete the sentence: *I can’t talk to you right now because I ...*',
        options: [
            { key: 'A', text: 'am study' },
            { key: 'B', text: 'are studying' },
            { key: 'C', text: 'am studying' },
        ],
        correctKey: 'C',
        explanationMd: 'With pronoun *I*, present continuous requires *am + studying*.',
        difficulty: 'easy',
        sourceRef: 'INGLES CUP 1-2023 #10',
    },
    {
        id: 'ing-004',
        subjectCode: 'ingles',
        topic: 'simple-present',
        statementMd:
            'Which is the correct auxiliary in the present: *He ……… a good computer in the morning.*',
        options: [
            { key: 'A', text: "don't find" },
            { key: 'B', text: "couldn't find" },
            { key: 'C', text: "doesn't find" },
        ],
        correctKey: 'C',
        explanationMd: 'Third-person singular (*He*) in simple present negative takes *doesn’t + base verb*.',
        difficulty: 'easy',
        sourceRef: 'INGLES CUP 1-2023 #14',
    },
    {
        id: 'ing-005',
        subjectCode: 'ingles',
        topic: 'simple-past',
        statementMd: 'Which is the correct form of the verb *permit* in the past?',
        options: [
            { key: 'A', text: 'permit' },
            { key: 'B', text: 'permited' },
            { key: 'C', text: 'permitted' },
            { key: 'D', text: 'permission' },
        ],
        correctKey: 'C',
        explanationMd:
            'Verbs ending in stressed consonant-vowel-consonant double the final consonant before *-ed*: *permitted*.',
        difficulty: 'medium',
        sourceRef: 'INGLES CUP 1-2023 #38',
    },
    {
        id: 'ing-006',
        subjectCode: 'ingles',
        topic: 'simple-past',
        statementMd: 'Choose the correct question in the past:',
        options: [
            { key: 'A', text: 'He taught Math yesterday?' },
            { key: 'B', text: 'Studied Mary English yesterday morning?' },
            { key: 'C', text: 'Did we thought to travel last week?' },
            { key: 'D', text: 'Did he drive a new car?' },
        ],
        correctKey: 'D',
        explanationMd: 'Past simple questions use *Did + subject + base form of the verb* (*Did he drive...*).',
        difficulty: 'easy',
        sourceRef: 'INGLES CUP 1-2023 #40',
    },
    {
        id: 'ing-007',
        subjectCode: 'ingles',
        topic: 'simple-past',
        statementMd: 'Which verb is in the simple past?',
        options: [
            { key: 'A', text: 'swum' },
            { key: 'B', text: 'swim' },
            { key: 'C', text: 'swimming' },
            { key: 'D', text: 'swam' },
        ],
        correctKey: 'D',
        explanationMd: 'The irregular verb *swim* has simple past *swam* and past participle *swum*.',
        difficulty: 'easy',
        sourceRef: 'INGLES CUP 1-2023 #41',
    },
    {
        id: 'ing-008',
        subjectCode: 'ingles',
        topic: 'prepositions',
        statementMd: 'Complete the sentence: *We don’t go to university ……… Monday.*',
        options: [
            { key: 'A', text: 'at' },
            { key: 'B', text: 'in' },
            { key: 'C', text: 'about' },
            { key: 'D', text: 'on' },
        ],
        correctKey: 'D',
        explanationMd: 'Days of the week always use the preposition *on* (*on Monday*).',
        difficulty: 'easy',
        sourceRef: 'INGLES CUP 1-2023 #69',
    },
    {
        id: 'ing-009',
        subjectCode: 'ingles',
        topic: 'nouns',
        statementMd: 'Which of the following is a singular noun?',
        options: [
            { key: 'A', text: 'child' },
            { key: 'B', text: 'children' },
            { key: 'C', text: 'people' },
            { key: 'D', text: 'men' },
        ],
        correctKey: 'A',
        explanationMd: '*Child* is singular; *children*, *people*, and *men* are irregular plural nouns.',
        difficulty: 'easy',
        sourceRef: 'INGLES CUP 1-2023 #71',
    },
    {
        id: 'ing-010',
        subjectCode: 'ingles',
        topic: 'wh-questions',
        statementMd:
            'Choose the correct interrogative question for the sentence: *He cries because he’s sad at home.*',
        options: [
            { key: 'A', text: 'Where does he cry?' },
            { key: 'B', text: 'When does he cry?' },
            { key: 'C', text: 'Why does he cry?' },
        ],
        correctKey: 'C',
        explanationMd: '*Because* expresses reason/cause, which answers a *Why* question.',
        difficulty: 'easy',
        sourceRef: 'INGLES CUP 1-2023 #78',
    },
];

async function upsertFaculty(code: string, name: string): Promise<string> {
    const [row] = await db
        .insert(faculties)
        .values({ code, name })
        .onConflictDoUpdate({
            target: faculties.code,
            set: { name },
        })
        .returning({ id: faculties.id });

    return row.id;
}

async function upsertSubject(
    facultyId: string,
    code: SubjectCode,
    name: string,
    perExam: number,
): Promise<string> {
    const [row] = await db
        .insert(subjects)
        .values({ facultyId, code, name, perExam })
        .onConflictDoUpdate({
            target: subjects.code,
            set: { facultyId, name, perExam },
        })
        .returning({ id: subjects.id });

    return row.id;
}

async function seedReal(): Promise<void> {
    console.log('🌱 Iniciando seeding real de FICCT (CUP Simulacro)...');

    const facultyId = await upsertFaculty(
        'ficct',
        'Facultad de Ingeniería en Ciencias de la Computación y Telecomunicaciones',
    );

    const subjectIds: Record<SubjectCode, string> = {
        ingles: await upsertSubject(facultyId, 'ingles', 'Inglés', 10),
        computacion: await upsertSubject(facultyId, 'computacion', 'Computación', 10),
        matematicas: await upsertSubject(facultyId, 'matematicas', 'Matemáticas', 10),
        fisica: await upsertSubject(facultyId, 'fisica', 'Física', 10),
    };

    for (const item of SEED_QUESTIONS) {
        const subjectId = subjectIds[item.subjectCode];
        await db
            .insert(questions)
            .values({
                id: item.id,
                facultyId,
                subjectId,
                topic: item.topic,
                statementMd: item.statementMd,
                options: item.options,
                correctKey: item.correctKey,
                explanationMd: item.explanationMd ?? null,
                procedureMd: item.procedureMd ?? null,
                difficulty: item.difficulty ?? null,
                status: 'verified',
                sourceRef: item.sourceRef,
            })
            .onConflictDoUpdate({
                target: questions.id,
                set: {
                    facultyId,
                    subjectId,
                    topic: item.topic,
                    statementMd: item.statementMd,
                    options: item.options,
                    correctKey: item.correctKey,
                    explanationMd: item.explanationMd ?? null,
                    procedureMd: item.procedureMd ?? null,
                    difficulty: item.difficulty ?? null,
                    status: 'verified',
                    sourceRef: item.sourceRef,
                    updatedAt: new Date(),
                },
            });
    }

    console.log(`✅ Seeding completado: ${SEED_QUESTIONS.length} preguntas verificadas (10 por materia).`);
}

try {
    await seedReal();
} finally {
    await closeDatabaseConnection();
}
