import {
    Type,
    forwardRef,
    Provider,
    Directive,
    Renderer,
    ElementRef,
    Component,
    ContentChildren,
    Query,
    QueryList,
    Input,
    Output,
    EventEmitter
} from 'angular2/core';
import {CONST_EXPR, isBlank} from 'angular2/src/facade/lang';
import {ObservableWrapper} from 'angular2/src/facade/async';
import {NG_VALUE_ACCESSOR, ControlValueAccessor, NgSelectOption} from 'angular2/common';
import {Subscription} from 'rxjs';

declare var $: JQueryStatic;

/**
 * The Select wraps the Materialize <select> element, which dynamically generates a styled list rather than use
 * the native <select> element.
 *
 * The value of the component (as specified by the `value` attribute or via ngModel etc.) should be a string, or in
 * the case of a multiple select (multiple="true), it should be an array of strings.
 *
 * Likewise the outputs passed to the event handlers will be a string or an array of strings, depending on whether
 * multiple === true.
 */
@Component({
    selector: 'gtx-select',
    template: require('./select.tpl.html')
})
export class Select {

    // native attributes
    @Input() disabled: boolean = false;
    @Input() multiple: boolean = false;
    @Input() name: string;
    @Input() required: boolean = false;

    @Input() value: string|string[];
    @Input() label: string = '';
    @Input() id: string;

    // events
    @Output() blur: EventEmitter<string|string[]> = new EventEmitter();
    @Output() focus: EventEmitter<string|string[]> = new EventEmitter();
    @Output() change: EventEmitter<string|string[]> = new EventEmitter();

    @ContentChildren(NgSelectOption, { descendants: true }) selectOptions: QueryList<NgSelectOption>;

    $nativeSelect: any;
    subscription: Subscription;

    /**
     * Event handler for when one of the Materialize-generated LI elements is clicked.
     */
    selectItemClick: (e: Event) => void = (e: Event) => {
        const fakeInput: HTMLInputElement = this.elementRef.nativeElement.querySelector('input.select-dropdown');
        const stringToArray: any = (str: string) => str.split(',').map((s: string) => s.trim());
        this.value = this.multiple ? stringToArray(fakeInput.value) : fakeInput.value;
        this.change.emit(this.value);
    };

    inputBlur: (e: Event) => void = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        this.blur.emit(this.value);
    };

    constructor(private elementRef: ElementRef) {}

    /**
     * If a `value` has been passed in, we mark the corresponding option as "selected".
     */
    ngAfterContentInit(): void {
        this.updateValue(this.value);
    }

    /**
     * We need to init the Materialize select, (see http://materializecss.com/forms.html)
     * and add our own event listeners to the LI elements that Materialize creates to
     * replace the native <select> element, and listeners for blur, focus and change
     * events on the fakeInput which Materialize creates in the place of the native <select>.
     */
    ngAfterViewInit(): void {
        const nativeSelect: HTMLSelectElement = this.elementRef.nativeElement.querySelector('select');

        this.$nativeSelect = $(nativeSelect);

        // in a setTimeout to get around a weird issue where the first option was
        // always being selected. I think it has to do with the fact that the ValueAccessor
        // needs to run to update the nativeSelect value to the correct value before we
        // init the Materialize magic.
        setTimeout(() => {
            this.$nativeSelect.material_select();

            // the Materialize material_select() function annoyingly sets the value of the nativeSelect and the
            // fakeInput to the first option in the list, if the value is empty:
            // https://github.com/Dogfalo/materialize/blob/418eaa13efff765a2d68dcc0bc1b3fabf8484183/js/forms.js#L587-L591
            // This is not what we want, so we need to override this and set the values back to what they were before
            // material_select() was invoked.
            this.updateValue(this.value);

            this.registerHandlers();
        });

        this.subscription = this.selectOptions.changes.subscribe(() => {
            this.unregisterHandlers();
            nativeSelect.value = <string>this.value;
            this.$nativeSelect.material_select();
            this.registerHandlers();
        });
    }

    /**
     * Clean up our manually-added event listeners.
     */
    ngOnDestroy(): void {
        this.unregisterHandlers();
        this.$nativeSelect.material_select('destroy');
        this.subscription.unsubscribe();
    }

    /**
     * Updates the value of the select component, setting the correct properties on the native DOM elements
     * depending on whether or not we are in "multiple" mode.
     */
    updateValue(value: string|string[]): void {
        if (value === undefined) {
            return;
        }
        const nativeSelect: HTMLSelectElement = this.elementRef.nativeElement.querySelector('select');
        const fakeInput: HTMLInputElement = this.elementRef.nativeElement.querySelector('input.select-dropdown');
        this.value = value;

        if (value instanceof Array) {
            const optionNodes: NodeListOf<HTMLOptionElement> = this.elementRef.nativeElement.querySelectorAll('option');
            const options: HTMLOptionElement[] = Array.prototype.slice.call(optionNodes);
            // The `multiple` property may not have been bound yet on the nativeSelect. Without this being
            // set to "true", we cannot select multiple options below.
            if (this.multiple && !nativeSelect.multiple) {
                nativeSelect.multiple = true;
            }
            options.forEach((option: HTMLOptionElement) => {
                option.selected = (-1 < this.value.indexOf(option.value));
            });
        } else {
            nativeSelect.value = <string> value;
        }

        if (fakeInput) {
            fakeInput.value = value !== null ? String(value) : '';
        }
    }

    private registerHandlers(): void {
        $(this.elementRef.nativeElement).find('li').on('click', this.selectItemClick);
        $(this.elementRef.nativeElement).find('input.select-dropdown').on('blur', this.inputBlur);
    }

    private unregisterHandlers(): void {
        $(this.elementRef.nativeElement).find('li').off('click', this.selectItemClick);
        $(this.elementRef.nativeElement).find('input.select-dropdown').off('blur', this.inputBlur);
    }
}



const GTX_SELECT_VALUE_ACCESSOR: Provider = CONST_EXPR(new Provider(
    NG_VALUE_ACCESSOR, {useExisting: forwardRef(() => GtxSelectValueAccessor), multi: true}));

@Directive({
    selector: 'gtx-select[ngModel], gtx-select[ngControl], gtx-select[ngFormControl]',
    host: {'(change)': 'onChange($event)', '(blur)': 'onTouched()'},
    bindings: [GTX_SELECT_VALUE_ACCESSOR]
})
export class GtxSelectValueAccessor implements ControlValueAccessor {
    value: string;
    onChange: any = (_: any) => {};
    onTouched: any = () => {};

    constructor(private selectInstance: Select,
                @Query(NgSelectOption, {descendants: true}) query: QueryList<NgSelectOption>) {
        this._updateValueWhenListOfOptionsChanges(query);
    }

    writeValue(value: any): void {
        this.selectInstance.updateValue(value);
    }

    registerOnChange(fn: (_: any) => any): void {
        this.onChange = () => {
            fn(this.selectInstance.value);
        };
    }
    registerOnTouched(fn: () => any): void { this.onTouched = fn; }

    private _updateValueWhenListOfOptionsChanges(query: QueryList<NgSelectOption>): void {
        ObservableWrapper.subscribe(query.changes, (_: any) => this.writeValue(this.value));
    }
}