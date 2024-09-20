# Structure

## Key Features

- The diagnostic is stored in `sourcefile._WritableData.accumulatedDiagnostics`
- what does create these diags ?
- how are these diags sent to vscode instance ?

## Diagnostics

- DiagnosticSink
- It seems that two diags are created for type error in an assignement statement but the first one created, erase the second one.
- 

## Function Node

there is two interesting fields :
- parameters : regroup the info about the parameters (especially if they have a type annotation)
- suite : contains the statements of the function
    - If there is a call site with an annotation, the annotation is retreived by the method getTypeOfExpressionCore in getTypeOfExpression
    - validateArgType seems to play a significant role

### visitFunction

- commence par un check sur un potention parametre de type (Ne concerne pas la version sur laquelle je suis)
- notify l'evaluateur en cas de skip d'une fonction non annoté (si l'option pour la faire est activée)
- récupère le type de la fonction (paramètres et return) (objet stocké en double ?)
- En cas, récupère la classe qui contient la fonction
- {Logique si le type de la fonction a pu être récupéré}
  - pour chaque parametre
    - stock le nom si c'est un parametre simple
    - détermine si on a affaire à un paramètre spécial
    - crée un diagnostic si il y a des arguments après un argument spécial
    - gestion du cas de paramètre nommé "_"
      - récupère les détails de type du paramètre en question
      - crée un diag si l'option est activé pour ce cas
      - crée un diag si le paramètre à une annotation de type 
    - vérifie que les paramètre stockés dans un dico ne se croisent pas avec d'autres paramètres
    - vérifie les utilisation incorrectes de args et kwargs
    - fais des vérification de méthodes si la fonction est située dans une classe
- Pour chaque paramètre de la fonction:
  - parcours les valeurs par défaut
  - parcours les annotations de type
  - parcours les commentaires d'annonation de type ???
  - ajoute un cas de diag avec les paramètres de type (pas concerné dans cette version)
- parcours l'annotation de type de retour 
- parcours le commentaire de l'annoation du type retour ???
  - Ajout un diagnostique en cas de problème avec le commentaire
- Parcours les décorateurs
- Parcours les noms de tous les paramètres
- analyse le complxité de la fonction
  - si elle est trop complexe elle est skip et un diag est créé
- Si le type de la fonction a pu être calculé 
  - valide les différentes parties de la fonction, notament, le type de retour
  - créer un diag si la fonction est @final sans être une méthode
- `__getattr__` ???
- ajoute le node de la fonction a la liste des scopedNode de l'evaluateur
- Gère les fonctions overloadé (c'est quoi ?)




## Program

- _sourceFileList : Contain a list of files that might be needed for typecheck

- `analyze()` :
    - register a callback which 
        - find the files that are opened and tagged for typecheck (The files are represented by a `SourceFileInfo` object)
        - call _checkTypes() for every file

- `_checkTypes()` :
    - invoke `SourceFile.check()` method on the `file.sourceFile` 

- `_parseFile()` : 
    - in `fileToParse` there is a reference to the sourceFile. it is not reinitialized so it contains the previous diags.

## SourceFile

- `parse()`: 
    - create a `diagnosticSink` (Class that collects and deduplicates diagnostics)
    - recover the content of a file
    - store the result of `_parseFile()` in `parseFileResults`
    - store the different element of `parseFileResult` in `this._writableData` (especially `parserOutput`)

- `check()`: 
    - register a callback which 
        - create a `Checker` with the output of the parser (stored in `_writableData`)
        - call the method `check` of the `Checker`  
        - create an AnalyserFileInfo variable called `fileInfo` (contains new diags)from `this._writableData.parserOutput!.parseTree` (this means the new diagnostics are stored in the `parseTree` which is a `ModuleNode`)
        - fetch the diagnostics from `fileInfo`
        - call the method `_recomputeDiagnostic`

- `_recomputeDiagnostic()`: 
    - recover all the diagnostic under `diagList` : `Diagnostic[]`
    - filter the diags depending on the ignore rules
    - store the effective list of diags in `this._WritableData.accumulatedDiagnostics`

- `getDiagnostic()` : return the content of `this._writableData.accumulatedDiagnostic`


## Parser

## Tokenizer

## Checker

- `parseResult` : a parser output for a file

- `check()` : I still don't understand how this method works
    - has access to the parser output

- `_walkStatementsAndReportUnreachable()` : create the diags
    - `statement` represent the different nodes of the checked program 
    - call `walk()` on every statement

- `walk()` : call `ParseTreeWalker.walk()`
- there is type cache in `typeEvaluator`
  

## WritableData

### CheckerDiagnostic

- Contain all the reports that are going to be made in the vscode instance
- The data is regrouped under a Diagnostic class